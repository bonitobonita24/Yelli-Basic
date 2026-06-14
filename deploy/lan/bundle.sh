#!/usr/bin/env bash
# deploy/lan/bundle.sh — build an offline installer tarball for the Yelli LAN edition.
#
# Run this on a machine WITH internet access (and Docker).
# The output is:
#   dist/yelli-lan-<date>.tar.gz        — distributable archive
#   dist/yelli-lan-<date>.tar.gz.sha256 — SHA-256 checksum file
#   dist/yelli-lan-<date>.tar.gz.sig    — detached signature (minisign or GPG)
#   dist/yelli-lan-<date>.manifest.txt  — image manifest
#
# Signing requires an owner-held private key (never generated here):
#   minisign: export YELLI_LAN_MINISIGN_KEY=/path/to/minisign.key
#   GPG:      export YELLI_LAN_GPG_KEY_ID=<key-id-or-fingerprint>
# If neither var is set, signing is skipped with a warning.
# To disable signing entirely (dev only): export YELLI_LAN_SKIP_SIGN=1
#
# Prerequisites:
#   - Docker (with internet)
#   - The three Yelli images must already be built and tagged locally:
#       yelli:lan           (Next.js app)
#       yelli-signaling:lan (signaling server)
#       yelli-worker:lan    (BullMQ worker)
#   - minisign OR gpg (for signed releases)
#
# Usage:
#   bash deploy/lan/bundle.sh [--skip-pull] [--out-dir <dir>] [--skip-sign]
#
#   --skip-pull   Skip pulling third-party images (use local cache only).
#   --out-dir     Output directory (default: dist/).
#   --skip-sign   Skip signing step (dev/CI use only; NOT for distribution).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

# ─── Defaults ────────────────────────────────────────────────────────────────

SKIP_PULL=false
SKIP_SIGN=false
OUT_DIR="$REPO_ROOT/dist"

# ─── Arg parsing ─────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull) SKIP_PULL=true; shift ;;
    --out-dir)   OUT_DIR="$2"; shift 2 ;;
    --skip-sign) SKIP_SIGN=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--skip-pull] [--out-dir <dir>] [--skip-sign]"
      echo ""
      echo "  --skip-pull   Do not pull third-party images (use local cache)."
      echo "  --out-dir     Output directory (default: dist/)."
      echo "  --skip-sign   Skip signing (dev only — NOT for distribution)."
      exit 0
      ;;
    *) err "Unknown flag: $1"; exit 1 ;;
  esac
done

# Also honour env-var escape hatch.
[ "${YELLI_LAN_SKIP_SIGN:-}" = "1" ] && SKIP_SIGN=true

mkdir -p "$OUT_DIR"

# ─── Third-party images to bundle ────────────────────────────────────────────
# NOTE: These tags use floating tags (:alpine, :latest) for consistency with the
# rest of the compose targets. For maximum reproducibility in air-gapped production
# deployments, re-pin each to a @sha256:<digest> before bundling — the manifest
# records the resolved digests so you can do this after bundle.sh runs.

THIRD_PARTY_IMAGES=(
  "postgres:16-alpine"
  "valkey/valkey:7-alpine"
  "minio/minio:latest"
  "caddy:2-alpine"
)

# ─── Yelli images (must be pre-built and tagged) ─────────────────────────────

YELLI_IMAGES=(
  "yelli:lan"
  "yelli-signaling:lan"
  "yelli-worker:lan"
)

ALL_IMAGES=("${THIRD_PARTY_IMAGES[@]}" "${YELLI_IMAGES[@]}")

# ─── Check Yelli images exist ────────────────────────────────────────────────

info "Checking Yelli images..."
MISSING_IMAGES=()
for img in "${YELLI_IMAGES[@]}"; do
  if ! docker image inspect "$img" >/dev/null 2>&1; then
    MISSING_IMAGES+=("$img")
  fi
done

if [ ${#MISSING_IMAGES[@]} -gt 0 ]; then
  err "The following Yelli images are not built/tagged locally:"
  for img in "${MISSING_IMAGES[@]}"; do
    printf '    %s\n' "$img"
  done
  echo ""
  warn "Build and tag them first, then re-run bundle.sh."
  echo ""
  echo "  How to build each image:"
  echo ""
  echo "  # Next.js app:"
  echo "  docker build -f apps/yelli/Dockerfile -t yelli:lan ."
  echo ""
  echo "  # Signaling server:"
  echo "  docker build -f apps/signaling/Dockerfile -t yelli-signaling:lan ."
  echo ""
  echo "  # BullMQ worker:"
  echo "  docker build -f packages/jobs/Dockerfile.workers -t yelli-worker:lan ."
  echo ""
  echo "  Run these from the repo root, then re-run bundle.sh."
  exit 1
fi
ok "All Yelli images present."

# ─── Pull third-party images ─────────────────────────────────────────────────

if [ "$SKIP_PULL" = false ]; then
  info "Pulling third-party images..."
  for img in "${THIRD_PARTY_IMAGES[@]}"; do
    info "  Pulling $img ..."
    docker pull "$img"
  done
  ok "Third-party images pulled."
else
  warn "Skipping image pull (--skip-pull). Using local cache."
fi

# ─── Save all images to tarball ──────────────────────────────────────────────

BUNDLE_DATE="$(date -u '+%Y%m%d')"
BUNDLE_STEM="yelli-lan-${BUNDLE_DATE}"
TAR_PATH="$OUT_DIR/${BUNDLE_STEM}.tar"
GZ_PATH="${TAR_PATH}.gz"
SHA256_FILE="${GZ_PATH}.sha256"
SIG_FILE="${GZ_PATH}.sig"
MANIFEST_PATH="$OUT_DIR/${BUNDLE_STEM}.manifest.txt"

info "Saving ${#ALL_IMAGES[@]} images to $TAR_PATH ..."
docker save "${ALL_IMAGES[@]}" -o "$TAR_PATH"

info "Compressing → $GZ_PATH ..."
gzip -f "$TAR_PATH"
ok "Saved: $GZ_PATH"

# ─── Compute SHA256 and write checksum file ──────────────────────────────────

info "Computing SHA256 ..."
if command -v sha256sum >/dev/null 2>&1; then
  SHA256=$(sha256sum "$GZ_PATH" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  SHA256=$(shasum -a 256 "$GZ_PATH" | awk '{print $1}')
else
  SHA256="(sha256sum not available)"
fi
ok "SHA256: $SHA256"

# Write a standalone checksum file (sha256sum-compatible format).
printf '%s  %s\n' "$SHA256" "$(basename "$GZ_PATH")" > "$SHA256_FILE"
ok "Checksum file: $SHA256_FILE"

# ─── Write manifest ──────────────────────────────────────────────────────────

{
  echo "# Yelli LAN Image Bundle Manifest"
  echo "# Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo ""
  echo "bundle:  $(basename "$GZ_PATH")"
  echo "sha256:  $SHA256"
  echo "sig:     $(basename "$SIG_FILE")  (detached signature over the archive)"
  echo ""
  echo "# Images included:"
  echo "# ─────────────────────────────────────────────────────────────────────"
  echo "#"
  echo "# TAG                         REPO DIGEST"
  echo "# ────────────────────────    ────────────────────────────────────────"

  for img in "${ALL_IMAGES[@]}"; do
    # Resolve the repo digest (content-addressable, reproducible).
    DIGEST=$(docker inspect --format '{{index .RepoDigests 0}}' "$img" 2>/dev/null || echo "(no digest — local image)")
    printf '%-30s  %s\n' "$img" "$DIGEST"
  done

  echo ""
  echo "# NOTE: Third-party images use floating tags (:alpine, :latest)."
  echo "# For air-gapped production use, re-pin each to its digest above:"
  echo "#   image: postgres@sha256:<digest>"
  echo "# then rebuild this bundle. The digest is content-addressable and will"
  echo "# not change unless the upstream image is republished."
  echo ""
  echo "# To verify the bundle on the target machine:"
  echo "#   sha256sum -c $(basename "$SHA256_FILE")"
  echo "#   minisign -Vm $(basename "$GZ_PATH") -p yelli-lan.pub"
  echo "#   # OR, if signed with GPG:"
  echo "#   gpg --verify $(basename "$SIG_FILE") $(basename "$GZ_PATH")"
} > "$MANIFEST_PATH"

ok "Manifest: $MANIFEST_PATH"

# ─── Sign the archive ────────────────────────────────────────────────────────

_do_sign() {
  local target="$1"  # file to sign (the .tar.gz)

  # Prefer minisign (dependency-light, purpose-built for file signing).
  if command -v minisign >/dev/null 2>&1 && [ -n "${YELLI_LAN_MINISIGN_KEY:-}" ]; then
    info "Signing with minisign (key: $YELLI_LAN_MINISIGN_KEY) ..."
    minisign -Sm "$target" -s "$YELLI_LAN_MINISIGN_KEY" -x "${target}.sig"
    ok "Signature: ${target}.sig  (minisign)"
    return 0
  fi

  # Fall back to GPG armored detached signature.
  if command -v gpg >/dev/null 2>&1 && [ -n "${YELLI_LAN_GPG_KEY_ID:-}" ]; then
    info "Signing with GPG (key id: $YELLI_LAN_GPG_KEY_ID) ..."
    gpg --batch --yes \
        --local-user "$YELLI_LAN_GPG_KEY_ID" \
        --armor \
        --detach-sign \
        --output "${target}.sig" \
        "$target"
    ok "Signature: ${target}.sig  (GPG armored)"
    return 0
  fi

  # Neither tool/key is available.
  if command -v minisign >/dev/null 2>&1 || command -v gpg >/dev/null 2>&1; then
    warn "Signing tool found but no key configured."
    warn "  For minisign: export YELLI_LAN_MINISIGN_KEY=/path/to/minisign.key"
    warn "  For GPG:      export YELLI_LAN_GPG_KEY_ID=<key-id-or-fingerprint>"
  else
    warn "Neither 'minisign' nor 'gpg' is installed. Install one to enable signing."
  fi
  warn "Bundle is UNSIGNED. Do not distribute this archive for production use."
  return 1
}

SIGNED=false
if [ "$SKIP_SIGN" = true ]; then
  warn "Signing skipped (--skip-sign / YELLI_LAN_SKIP_SIGN=1). NOT for distribution."
else
  if _do_sign "$GZ_PATH"; then
    SIGNED=true
  fi
fi

echo ""
printf '══════════════════════════════════════════════════════\n'
ok " Bundle complete."
printf '\n'
printf '  Archive:      %s\n' "$GZ_PATH"
printf '  Checksum:     %s\n' "$SHA256_FILE"
if [ "$SIGNED" = true ]; then
  printf '  Signature:    %s\n' "$SIG_FILE"
else
  printf '  Signature:    %s[UNSIGNED]%s\n' "$YLW" "$RST"
fi
printf '  Manifest:     %s\n' "$MANIFEST_PATH"
printf '  SHA256:       %s\n' "$SHA256"
printf '\n'
printf '  Transfer the archive, checksum, and signature files, plus\n'
printf '  this repo, to the target (offline) PC, then run:\n'
printf '    bash deploy/lan/install.sh\n'
printf '══════════════════════════════════════════════════════\n\n'
