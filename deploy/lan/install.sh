#!/usr/bin/env bash
# deploy/lan/install.sh — Yelli LAN Edition installer.
#
# Portable: Linux, macOS, WSL2, Git-Bash.
# Idempotent — safe to re-run.
#
# Usage:
#   bash deploy/lan/install.sh [OPTIONS]
#
# Options:
#   --ip <addr>          Override auto-detected LAN IP.
#   --bundle <path>      Path to the image bundle tarball.
#                        Default: auto-detected from dist/yelli-lan-*.tar.gz
#   --pubkey <path>      Path to the public key used to verify the bundle signature.
#                        minisign: path to yelli-lan.pub
#                        GPG:      path to exported .asc / .gpg public key
#                        Default: deploy/lan/yelli-lan.pub (if present)
#   --skip-verify        SKIP signature and checksum verification.
#                        DEV / CI ONLY — never use for production installs.
#   --skip-load          Skip loading Docker images (use already-loaded images).
#   --force              Regenerate .env.lan and certs even if they exist.
#   --refresh-cert       Re-check the LAN IP, regenerate the cert if it changed,
#                        re-render the Caddyfile, and reload Caddy — without a
#                        full reinstall.  Safe to run any time the host IP may
#                        have changed (e.g. after a DHCP reassignment).
#   --down               Stop and remove the LAN stack (does not remove volumes).
#   -h, --help           Show this help message.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_DIR="$REPO_ROOT/deploy/compose/lan"

# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

# ─── Defaults ────────────────────────────────────────────────────────────────

BUNDLE_PATH=""          # auto-detected below if not set via --bundle
PUBKEY_PATH="$SCRIPT_DIR/yelli-lan.pub"
SKIP_VERIFY=false
SKIP_LOAD=false
FORCE=false
DO_DOWN=false
REFRESH_CERT=false
IP_OVERRIDE=""

# ─── Arg parsing ─────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip)           IP_OVERRIDE="$2"; shift 2 ;;
    --bundle)       BUNDLE_PATH="$2"; shift 2 ;;
    --pubkey)       PUBKEY_PATH="$2"; shift 2 ;;
    --skip-verify)  SKIP_VERIFY=true; shift ;;
    --skip-load)    SKIP_LOAD=true; shift ;;
    --force)        FORCE=true; shift ;;
    --refresh-cert) REFRESH_CERT=true; SKIP_LOAD=true; shift ;;
    --down)         DO_DOWN=true; shift ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) err "Unknown flag: $1  (run with --help for usage)"; exit 1 ;;
  esac
done

# Auto-detect bundle path: pick the newest yelli-lan-*.tar.gz in dist/.
if [ -z "$BUNDLE_PATH" ]; then
  BUNDLE_PATH=$(ls -t "$REPO_ROOT/dist/yelli-lan-"*.tar.gz 2>/dev/null | head -1 || true)
  if [ -z "$BUNDLE_PATH" ]; then
    # Fallback to legacy name (pre-signed-archive builds).
    BUNDLE_PATH="$REPO_ROOT/dist/yelli-lan-images.tar.gz"
  fi
fi

# ─── Helpers ─────────────────────────────────────────────────────────────────

COMPOSE_CMD=(docker compose
  --env-file "$REPO_ROOT/.env.lan"
  -f "$COMPOSE_DIR/docker-compose.db.yml"
  -f "$COMPOSE_DIR/docker-compose.cache.yml"
  -f "$COMPOSE_DIR/docker-compose.storage.yml"
  -f "$COMPOSE_DIR/docker-compose.worker.yml"
  -f "$COMPOSE_DIR/docker-compose.signaling.yml"
  -f "$COMPOSE_DIR/docker-compose.app.yml"
  -f "$COMPOSE_DIR/docker-compose.proxy.yml"
)

# ─── --down mode ─────────────────────────────────────────────────────────────

if [ "$DO_DOWN" = true ]; then
  info "Stopping Yelli LAN stack..."
  "${COMPOSE_CMD[@]}" down --remove-orphans || true
  ok "Stack stopped. Volumes are preserved."
  exit 0
fi

# ─── Step (a): Preflight ─────────────────────────────────────────────────────

info "Running preflight checks..."
bash "$SCRIPT_DIR/preflight.sh"
# preflight exits nonzero on failure — errexit will stop us here.

# ─── Step (a2): Verify bundle signature and checksum ─────────────────────────

# Helper: verify the archive and abort on failure.
_verify_bundle() {
  local archive="$1"
  local sha256_file="${archive}.sha256"
  local sig_file="${archive}.sig"
  local pubkey="$PUBKEY_PATH"
  local ok_checksum=false
  local ok_sig=false
  local sig_tool=""

  info "Verifying bundle: $(basename "$archive") ..."

  # --- SHA-256 checksum ---
  if [ ! -f "$sha256_file" ]; then
    err "Checksum file not found: $sha256_file"
    err "Cannot verify bundle integrity. Aborting."
    err "Pass --skip-verify to bypass (dev only — NOT safe for production)."
    exit 1
  fi

  # Verify checksum from inside the archive's directory so the filename matches.
  local archive_dir
  archive_dir="$(dirname "$archive")"
  if command -v sha256sum >/dev/null 2>&1; then
    if (cd "$archive_dir" && sha256sum -c "$(basename "$sha256_file")" --status 2>/dev/null); then
      ok "SHA-256 checksum: PASS"
      ok_checksum=true
    fi
  elif command -v shasum >/dev/null 2>&1; then
    local expected_hash
    expected_hash=$(awk '{print $1}' "$sha256_file")
    local actual_hash
    actual_hash=$(shasum -a 256 "$archive" | awk '{print $1}')
    if [ "$expected_hash" = "$actual_hash" ]; then
      ok "SHA-256 checksum: PASS"
      ok_checksum=true
    fi
  else
    warn "sha256sum / shasum not available — cannot verify checksum."
    warn "Install coreutils (Linux) or shasum (macOS) for integrity checking."
  fi

  if [ "$ok_checksum" = false ] && command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1; then
    err "SHA-256 checksum MISMATCH — archive may be corrupted or tampered."
    err "Archive: $archive"
    err "Expected: $(awk '{print $1}' "$sha256_file")"
    exit 1
  fi

  # --- Signature verification ---
  if [ ! -f "$sig_file" ]; then
    warn "Signature file not found: $sig_file"
    warn "Bundle authenticity cannot be verified."
    warn "If this is a dev/test bundle without signing, pass --skip-verify."
    exit 1
  fi

  # Detect signing format from the first byte (minisign sigs start with "untrusted comment").
  if head -1 "$sig_file" 2>/dev/null | grep -q '^untrusted comment:'; then
    sig_tool="minisign"
  else
    sig_tool="gpg"
  fi

  if [ "$sig_tool" = "minisign" ]; then
    if ! command -v minisign >/dev/null 2>&1; then
      err "Signature is a minisign signature but 'minisign' is not installed."
      err "Install minisign: https://jedisct1.github.io/minisign/"
      exit 1
    fi
    if [ ! -f "$pubkey" ]; then
      err "Public key file not found: $pubkey"
      err "Pass --pubkey <path> pointing to the yelli-lan.pub distributed with the bundle."
      exit 1
    fi
    if minisign -Vm "$archive" -p "$pubkey" -x "$sig_file" >/dev/null 2>&1; then
      ok "Signature (minisign): VALID"
      ok_sig=true
    else
      err "Signature INVALID (minisign). Archive may have been tampered with."
      exit 1
    fi
  else
    # GPG armored detached signature.
    if ! command -v gpg >/dev/null 2>&1; then
      err "Signature appears to be a GPG signature but 'gpg' is not installed."
      exit 1
    fi
    # Import the public key if a keyfile was provided and isn't already in the keyring.
    if [ -f "$pubkey" ] && { [[ "$pubkey" == *.asc ]] || [[ "$pubkey" == *.gpg ]]; }; then
      gpg --batch --import "$pubkey" >/dev/null 2>&1 || true
    fi
    if gpg --batch --verify "$sig_file" "$archive" >/dev/null 2>&1; then
      ok "Signature (GPG): VALID"
      ok_sig=true
    else
      err "Signature INVALID (GPG). Archive may have been tampered with."
      err "Ensure the signer's public key is in your GPG keyring, or pass --pubkey <key.asc>."
      exit 1
    fi
  fi

  if [ "$ok_sig" = false ]; then
    err "Bundle verification failed. Aborting installation."
    exit 1
  fi

  ok "Bundle verified — checksum and signature are valid."
}

if [ "$SKIP_LOAD" = true ]; then
  # Nothing to verify if we're not loading a bundle at all.
  true
elif [ "$SKIP_VERIFY" = true ]; then
  warn "╔══════════════════════════════════════════════════════╗"
  warn "║  WARNING: --skip-verify  —  signature check SKIPPED ║"
  warn "║  NEVER use --skip-verify for production installs.   ║"
  warn "╚══════════════════════════════════════════════════════╝"
else
  if [ ! -f "$BUNDLE_PATH" ]; then
    err "Image bundle not found: $BUNDLE_PATH"
    err "Pass --bundle <path> or run deploy/lan/bundle.sh first."
    exit 1
  fi
  _verify_bundle "$BUNDLE_PATH"
fi

# ─── Step (b): Load images ───────────────────────────────────────────────────

if [ "$SKIP_LOAD" = true ]; then
  info "Skipping image load (--skip-load)."
else
  if [ ! -f "$BUNDLE_PATH" ]; then
    err "Image bundle not found: $BUNDLE_PATH"
    err "Pass --bundle <path> or run deploy/lan/bundle.sh first."
    exit 1
  fi
  info "Loading images from $BUNDLE_PATH ..."
  docker load -i "$BUNDLE_PATH"
  ok "Images loaded."
fi

# ─── Step (c): Detect LAN IP ─────────────────────────────────────────────────

if [ -n "$IP_OVERRIDE" ]; then
  export LAN_IP="$IP_OVERRIDE"
  info "Using provided LAN IP: $LAN_IP"
else
  LAN_IP=$(detect_lan_ip)
  info "Detected LAN IP: $LAN_IP"
fi

# ─── Step (d): mkcert + IP-change detection ──────────────────────────────────

CERTS_DIR="$REPO_ROOT/certs"
CERT_FILE="$CERTS_DIR/lan.pem"
KEY_FILE="$CERTS_DIR/lan-key.pem"
CERT_STATE="$CERTS_DIR/.cert-state"   # persists the IP the cert was last issued for

# _read_cert_state — echoes the IP stored in .cert-state, or empty string.
_read_cert_state() {
  if [ -f "$CERT_STATE" ]; then
    grep -E '^CERT_IP=' "$CERT_STATE" 2>/dev/null | cut -d= -f2 || true
  fi
}

# _write_cert_state — records the current LAN_IP + a timestamp.
_write_cert_state() {
  mkdir -p "$CERTS_DIR"
  printf 'CERT_IP=%s\nCERT_ISSUED_AT=%s\n' "$LAN_IP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$CERT_STATE"
}

# _need_new_cert — returns 0 (regenerate) or 1 (reuse).
_need_new_cert() {
  [ "$FORCE" = true ]        && return 0
  [ "$REFRESH_CERT" = true ] && return 0
  [ ! -f "$CERT_FILE" ]      && return 0
  [ ! -f "$KEY_FILE" ]       && return 0
  # If the cert exists but doesn't cover the current LAN_IP, regenerate.
  if command -v openssl >/dev/null 2>&1; then
    if ! openssl x509 -in "$CERT_FILE" -text -noout 2>/dev/null | grep -q "$LAN_IP"; then
      warn "Existing cert does not cover $LAN_IP — regenerating."
      return 0
    fi
  fi
  return 1
}

# ── IP-change detection ──────────────────────────────────────────────────────
PREV_CERT_IP="$(_read_cert_state)"
IP_CHANGED=false

if [ -n "$PREV_CERT_IP" ] && [ "$PREV_CERT_IP" != "$LAN_IP" ]; then
  IP_CHANGED=true
  printf '\n'
  printf '%s╔══════════════════════════════════════════════════════════════╗%s\n' "$YLW" "$RST"
  printf '%s║  ⚠  LAN IP CHANGED — TLS CERTIFICATE WILL BE REGENERATED   ║%s\n' "$YLW" "$RST"
  printf '%s║                                                              ║%s\n' "$YLW" "$RST"
  printf '%s║  Previous IP:  %-44s ║%s\n' "$YLW" "$PREV_CERT_IP" "$RST"
  printf '%s║  New IP:       %-44s ║%s\n' "$YLW" "$LAN_IP" "$RST"
  printf '%s║                                                              ║%s\n' "$YLW" "$RST"
  printf '%s║  The old cert is no longer valid.  A new mkcert certificate  ║%s\n' "$YLW" "$RST"
  printf '%s║  will be issued for the new IP.  If other LAN devices        ║%s\n' "$YLW" "$RST"
  printf '%s║  trusted the previous cert, they may see a browser warning   ║%s\n' "$YLW" "$RST"
  printf '%s║  until the mkcert root CA is re-distributed.                 ║%s\n' "$YLW" "$RST"
  printf '%s╚══════════════════════════════════════════════════════════════╝%s\n' "$YLW" "$RST"
  printf '\n'
fi

# ── Issue or reuse the cert ──────────────────────────────────────────────────
if _need_new_cert || [ "$IP_CHANGED" = true ]; then
  info "Installing local CA with mkcert..."
  mkcert -install
  mkdir -p "$CERTS_DIR"
  info "Generating cert for $LAN_IP, localhost, 127.0.0.1 ..."
  mkcert \
    -cert-file "$CERT_FILE" \
    -key-file  "$KEY_FILE"  \
    "$LAN_IP" localhost 127.0.0.1
  _write_cert_state
  ok "Cert written to certs/ (gitignored).  State recorded in certs/.cert-state."
else
  ok "Existing cert covers $LAN_IP — skipping mkcert. (Use --force or --refresh-cert to regenerate.)"
fi

# ─── Step (e): Generate .env.lan ─────────────────────────────────────────────

ENV_FILE="$REPO_ROOT/.env.lan"
ENV_EXAMPLE="$REPO_ROOT/.env.lan.example"

_write_env() {
  info "Generating .env.lan from .env.lan.example ..."

  # Read template.
  local template
  template=$(cat "$ENV_EXAMPLE")

  # Substitute LAN_IP.
  template=$(printf '%s' "$template" | sed "s|192\.168\.1\.100|${LAN_IP}|g")

  # Replace each __generated_at_install__ with a unique secret.
  # Variables we need to patch: DB_PASSWORD, REDIS_PASSWORD, STORAGE_SECRET_KEY,
  # S3_SECRET_KEY, AUTH_SECRET.  AUTH_SECRET gets ≥48 chars; the rest get 32.
  local db_pass redis_pass storage_key s3_key auth_secret

  db_pass=$(gen_secret 32)
  redis_pass=$(gen_secret 32)
  storage_key=$(gen_secret 32)
  s3_key=$(gen_secret 32)
  auth_secret=$(gen_secret 48)

  # Replace occurrences in order — each __ placeholder maps to a specific var line.
  # We do it by targeting the variable name on the same line to be precise.
  template=$(printf '%s' "$template" \
    | sed "s|^DB_PASSWORD=__generated_at_install__|DB_PASSWORD=${db_pass}|" \
    | sed "s|^REDIS_PASSWORD=__generated_at_install__|REDIS_PASSWORD=${redis_pass}|" \
    | sed "s|^STORAGE_SECRET_KEY=__generated_at_install__|STORAGE_SECRET_KEY=${storage_key}|" \
    | sed "s|^S3_SECRET_KEY=__generated_at_install__|S3_SECRET_KEY=${s3_key}|" \
    | sed "s|^AUTH_SECRET=__generated_at_install__|AUTH_SECRET=${auth_secret}|" \
  )

  # Catch any remaining unset placeholders (shouldn't happen, but be safe).
  if printf '%s' "$template" | grep -q '__generated_at_install__'; then
    warn "Some __generated_at_install__ placeholders remain — check .env.lan manually."
  fi

  printf '%s\n' "$template" > "$ENV_FILE"
  ok ".env.lan generated."
}

if [ -f "$ENV_FILE" ] && [ "$FORCE" = false ]; then
  # Back up and warn; don't silently clobber generated secrets.
  BACKUP="$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
  warn ".env.lan already exists. Backing up to $(basename "$BACKUP")."
  warn "Pass --force to regenerate secrets. Using existing .env.lan for now."
  cp "$ENV_FILE" "$BACKUP"
  # Still write the LAN_IP into the existing file in case IP changed.
  sed -i "s|^LAN_IP=.*|LAN_IP=${LAN_IP}|" "$ENV_FILE"
  sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://${LAN_IP}|" "$ENV_FILE"
  sed -i "s|^NEXT_PUBLIC_SIGNALING_URL=.*|NEXT_PUBLIC_SIGNALING_URL=wss://${LAN_IP}/ws|" "$ENV_FILE"
  ok "Updated LAN_IP in existing .env.lan (secrets preserved)."
else
  _write_env
fi

# Resolve COMPOSE_PROJECT_NAME from .env.lan for use in step (f).
COMPOSE_PROJECT_NAME=$(grep '^COMPOSE_PROJECT_NAME=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export COMPOSE_PROJECT_NAME

# ─── Step (f): Render Caddyfile ──────────────────────────────────────────────

CADDYFILE_TPL="$COMPOSE_DIR/Caddyfile.template"
CADDYFILE="$COMPOSE_DIR/Caddyfile"

info "Rendering Caddyfile from template (LAN_IP=${LAN_IP}, project=${COMPOSE_PROJECT_NAME}) ..."

if command -v envsubst >/dev/null 2>&1; then
  # envsubst is cleaner; export the vars it needs.
  export LAN_IP COMPOSE_PROJECT_NAME
  envsubst '${LAN_IP} ${COMPOSE_PROJECT_NAME}' < "$CADDYFILE_TPL" > "$CADDYFILE"
else
  # Pure sed fallback.
  sed \
    -e "s|\${LAN_IP}|${LAN_IP}|g" \
    -e "s|\${COMPOSE_PROJECT_NAME}|${COMPOSE_PROJECT_NAME}|g" \
    "$CADDYFILE_TPL" > "$CADDYFILE"
fi
ok "Caddyfile rendered to deploy/compose/lan/Caddyfile."

# ─── --refresh-cert fast path ────────────────────────────────────────────────
# When called with --refresh-cert (or from refresh-cert.sh), we stop here:
# cert + Caddyfile are already up to date; just reload Caddy in-place.

if [ "$REFRESH_CERT" = true ]; then
  info "Reloading Caddy to pick up the new certificate ..."
  # docker compose exec caddy caddy reload is the clean way; fall back to
  # a container restart if exec is unavailable (older Docker versions).
  if "${COMPOSE_CMD[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null; then
    ok "Caddy reloaded — new certificate is active."
  else
    warn "caddy reload not available; restarting the caddy container instead ..."
    "${COMPOSE_CMD[@]}" restart caddy
    ok "Caddy restarted — new certificate is active."
  fi
  echo ""
  ok "IP-change cert refresh complete.  New IP: ${LAN_IP}"
  printf '  Access URL:  %shttps://%s%s\n' "$GRN" "$LAN_IP" "$RST"
  echo ""
  exit 0
fi

# ─── Step (g): Bring the stack up ────────────────────────────────────────────

info "Starting Yelli LAN stack..."
"${COMPOSE_CMD[@]}" up -d --remove-orphans
ok "Stack started."

# ─── Step (h): Wait for app health ───────────────────────────────────────────

info "Waiting for app to become healthy (up to 120s) ..."
HEALTH_URL="https://127.0.0.1/_pwbt/health"
RETRIES=24
INTERVAL=5
HEALTHY=false

for i in $(seq 1 $RETRIES); do
  STATUS=$(curl -sk -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || true)
  if [ "$STATUS" = "200" ]; then
    HEALTHY=true
    break
  fi
  printf '  ... attempt %d/%d (HTTP %s)\r' "$i" "$RETRIES" "$STATUS"
  sleep $INTERVAL
done
echo ""

if [ "$HEALTHY" = true ]; then
  ok "App is healthy."
else
  warn "App health check did not return 200 after ${RETRIES} attempts."
  warn "The stack may still be starting. Check logs:"
  warn "  docker compose --env-file .env.lan -f deploy/compose/lan/docker-compose.app.yml logs app"
fi

# ─── Done ────────────────────────────────────────────────────────────────────

echo ""
printf '══════════════════════════════════════════════════════════════\n'
ok " Yelli LAN Edition is running!"
printf '\n'
printf '  Access URL:  %shttps://%s%s\n' "$GRN" "$LAN_IP" "$RST"
printf '\n'
printf '  First run:\n'
printf '    1. Open https://%s in your browser.\n' "$LAN_IP"
printf '    2. Navigate to https://%s/setup\n' "$LAN_IP"
printf '    3. Set your admin passphrase (stored as Argon2id hash).\n'
printf '\n'
printf '  Accessing from other LAN devices:\n'
printf '    - Open https://%s in their browser.\n' "$LAN_IP"
printf '    - To avoid "connection not private" warnings (and ensure\n'
printf '      camera/mic works without clicking through), install the\n'
printf '      mkcert root CA on each device:\n'
printf '        mkcert -CAROOT    # shows the CA root path on THIS machine\n'
printf '      Copy rootCA.pem to the other device and trust it, OR\n'
printf '      accept the browser warning (camera/mic still works on HTTPS).\n'
printf '\n'
printf '  To stop the stack:\n'
printf '    bash deploy/lan/install.sh --down\n'
printf '\n'
printf '  To re-run / update IP (after network change):\n'
printf '    bash deploy/lan/install.sh --force\n'
printf '══════════════════════════════════════════════════════════════\n\n'
