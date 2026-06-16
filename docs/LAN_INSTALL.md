# Yelli LAN Edition — Offline Installer Guide

## Overview

The LAN edition runs Yelli entirely on a single PC on your local network — no internet connection required after initial setup. It is designed for deployments where:

- The PC is always-on and serves as the local server.
- Other devices on the same LAN (phones, tablets, laptops) access the app via the browser at `https://<LAN-IP>`.
- There is no public domain or cloud account.

**Architecture:**
- Single implicit tenant (LAN = one organisation).
- Anonymous admin account — first-run setup via `/setup` sets an Argon2id passphrase.
- All traffic goes through a Caddy reverse proxy (HTTPS/WSS) backed by a mkcert-minted certificate.
- WebRTC signaling served at `wss://<LAN-IP>/ws` through the same Caddy proxy.
- All services run in Docker containers on the host machine, reachable on the internal Docker network only (except Caddy on ports 80 and 443).

---

## Prerequisites

**Install these tools BEFORE running the installer.**

### 1. Docker Engine / Docker Desktop + Docker Compose v2

| OS | Install command |
|----|----------------|
| Ubuntu / Debian | `curl -fsSL https://get.docker.com \| sh` then `sudo usermod -aG docker $USER` |
| RHEL / Fedora | `sudo dnf install docker-ce docker-compose-plugin` |
| macOS | `brew install --cask docker` OR download [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| Windows | Download [Docker Desktop](https://www.docker.com/products/docker-desktop/) (enable WSL2 backend) |
| WSL2 | Install Docker Desktop on Windows (WSL2 integration auto-configures Linux) |

Verify: `docker compose version` — must show **v2.x**.

> The legacy `docker-compose` (v1, Python, hyphenated) is **NOT supported**. Only the `docker compose` plugin (v2) works.

### 2. mkcert

mkcert mints locally-trusted TLS certificates using a local Certificate Authority (CA) it installs into your OS/browser trust store. **This is required.** See the [Why mkcert / HTTPS](#why-mkcert--https) section below.

| OS | Install command |
|----|----------------|
| Ubuntu / Debian | `sudo apt install libnss3-tools` then download binary from [releases](https://github.com/FiloSottile/mkcert/releases) |
| RHEL / Fedora | `sudo dnf install nss-tools` then download binary |
| macOS | `brew install mkcert` |
| Windows | `choco install mkcert` OR `scoop install mkcert` |
| Any (snap) | `sudo snap install mkcert` |

Verify: `mkcert --version`

### 3. Bundle verification tool (minisign or GPG) — required for production installs

The LAN bundle ships as a **signed archive**. The installer verifies both the SHA-256 checksum and the detached signature before loading any images. You need one of:

| Tool | Install |
|------|---------|
| **minisign** (preferred — purpose-built, single binary) | `brew install minisign` / [releases](https://jedisct1.github.io/minisign/#downloads) / `sudo apt install minisign` |
| **GPG** | `sudo apt install gnupg` / `brew install gnupg` / bundled with Git for Windows |

Verify: `minisign --version` or `gpg --version`

> If neither tool is found, `preflight.sh` prints an advisory warning and `install.sh` aborts before loading images. Pass `--skip-verify` only for local dev/CI scenarios — never for production installs.

---

## Signed Archive Distribution Model

Starting with the signed-archive release, the bundle pipeline produces four files per build:

```
dist/
  yelli-lan-<YYYYMMDD>.tar.gz        ← distributable image archive
  yelli-lan-<YYYYMMDD>.tar.gz.sha256 ← SHA-256 checksum (sha256sum-compatible)
  yelli-lan-<YYYYMMDD>.tar.gz.sig    ← detached signature (minisign or GPG)
  yelli-lan-<YYYYMMDD>.manifest.txt  ← image manifest with digests
```

Operators receive all four files. `install.sh` checks the checksum then the signature before any Docker operations run. A tampered or corrupted archive is rejected before any images are loaded.

### Key management (owner responsibility)

The **private signing key is an owner-held credential**. It is never generated or embedded by the tooling.

> **Status (2026-06-16):** The production minisign keypair has been generated. The public key
> (`deploy/lan/yelli-lan.pub`, key ID `18572C31CA69B095`) is committed. The private key is stored
> in `Server-Setups/Powerbyte-Hostinger/secrets/` (SOPS+age encrypted) — not in this repo.
> The "generate a keypair" step below is reference documentation for key rotation only.

**minisign (recommended):**
```bash
# One-time: generate a keypair (run on the owner's air-gapped or secure machine).
# -W = no password (passwordless for unattended/CI signing; secret key file is the security boundary).
minisign -G -W -p deploy/lan/yelli-lan.pub -s /secure/path/minisign.key

# Export the private key path for bundle.sh:
export YELLI_LAN_MINISIGN_KEY=/secure/path/minisign.key

# The public key (yelli-lan.pub) lives in deploy/lan/ and is committed to the repo.
# Ship it alongside the bundle or distribute it out-of-band (e.g. company wiki, email).
```

**GPG (alternative):**
```bash
# One-time: generate a keypair.
gpg --full-generate-key

# Export the key id for bundle.sh:
export YELLI_LAN_GPG_KEY_ID=<fingerprint-or-email>

# Publish the public key for operators:
gpg --armor --export "$YELLI_LAN_GPG_KEY_ID" > deploy/lan/yelli-lan.asc
# Operators import it: gpg --import yelli-lan.asc
```

> **Never commit the private key** (`minisign.key` or the GPG secret key) to the repository. The public key (`yelli-lan.pub` or `yelli-lan.asc`) should be committed to `deploy/lan/` and distributed with every bundle.

### Publishing / shipping a signed bundle

1. Build and tag the three Yelli images (see Step 1a below).
2. Run `bundle.sh` with the private key exported:
   ```bash
   export YELLI_LAN_MINISIGN_KEY=/secure/path/minisign.key
   bash deploy/lan/bundle.sh
   ```
3. Transfer the four output files (`*.tar.gz`, `*.sha256`, `*.sig`, `*.manifest.txt`) and the public key (`deploy/lan/yelli-lan.pub`) to the target PC — via USB, local SMB share, or any trusted channel.
4. The operator runs `install.sh` as documented below; verification is automatic.

---

## Why mkcert / HTTPS

Browsers enforce the **Secure Context** requirement: APIs like `getUserMedia` (camera and microphone), Web Push, and Service Workers are **blocked** on plain HTTP origins — even on a local LAN IP.

On a bare LAN IP (`192.168.1.x`) there is no way to get a publicly-signed TLS certificate (no domain, no ACME). mkcert solves this by:

1. Creating a local CA and installing it into your OS and browser trust stores.
2. Minting a certificate for your LAN IP (and `localhost`) signed by that CA.
3. Browsers on this machine trust the cert natively, so the origin is Secure.

Caddy serves both the Next.js app (HTTPS) and the WebSocket signaling server (WSS) through this certificate — a single unified HTTPS origin.

---

## Step 1 — Build & Bundle (internet-connected machine)

Do this on a machine that has Docker and internet access. This is typically the development machine, not the target offline PC (though it can be the same machine if it has internet at the time of bundling).

### 1a. Build and tag the three Yelli images

From the repo root:

```bash
# Next.js app
docker build -f apps/yelli/Dockerfile -t yelli:lan .

# Signaling server
docker build -f apps/signaling/Dockerfile -t yelli-signaling:lan .

# BullMQ worker
docker build -f packages/jobs/Dockerfile.workers -t yelli-worker:lan .
```

### 1b. Run bundle.sh

```bash
# With signing (production — requires a private key):
export YELLI_LAN_MINISIGN_KEY=/secure/path/minisign.key   # or YELLI_LAN_GPG_KEY_ID
bash deploy/lan/bundle.sh

# Without signing (dev / local test only):
bash deploy/lan/bundle.sh --skip-sign
```

This:
- Pulls the four third-party images (`postgres:16-alpine`, `valkey/valkey:7-alpine`, `minio/minio:latest`, `caddy:2-alpine`).
- Saves all seven images into `dist/yelli-lan-<YYYYMMDD>.tar.gz`.
- Writes `dist/yelli-lan-<YYYYMMDD>.tar.gz.sha256` (checksum file).
- Produces `dist/yelli-lan-<YYYYMMDD>.tar.gz.sig` (detached signature — minisign or GPG).
- Writes `dist/yelli-lan-<YYYYMMDD>.manifest.txt` with image digests.

Options:
```bash
bash deploy/lan/bundle.sh --skip-pull         # Use locally cached third-party images
bash deploy/lan/bundle.sh --out-dir /tmp/bundle
bash deploy/lan/bundle.sh --skip-sign         # Dev only — do not distribute unsigned bundles
```

### 1c. Transfer to the target PC

Copy **all four output files** (`*.tar.gz`, `*.sha256`, `*.sig`, `*.manifest.txt`) from `dist/`, plus the public key (`deploy/lan/yelli-lan.pub`), and the entire repo to the target PC via USB drive, local network transfer, etc. The target PC does not need internet.

> The installer auto-detects the newest `yelli-lan-*.tar.gz` in `dist/`. If only one date-stamped bundle is present, no `--bundle` flag is needed.

---

## Step 2 — Install (offline target PC)

### 2a. Check prerequisites

```bash
bash deploy/lan/preflight.sh
```

This checks for `docker`, `docker compose` v2, and `mkcert`. It prints per-OS install guidance for anything missing.

### 2b. Run the installer

```bash
bash deploy/lan/install.sh
```

The installer performs these steps automatically:

1. **Preflight** — re-runs the prerequisite check; aborts on failure.
2. **Verify bundle** — checks SHA-256 checksum then verifies the detached signature against `deploy/lan/yelli-lan.pub`. Aborts on any mismatch.
3. **Load images** — `docker load -i dist/yelli-lan-<date>.tar.gz`.
4. **Detect LAN IP** — reads your primary network interface IP. Override with `--ip <addr>`.
5. **mkcert** — installs the local CA (`mkcert -install`) then mints `certs/lan.pem` + `certs/lan-key.pem` for your LAN IP, `localhost`, and `127.0.0.1`. The `certs/` folder is gitignored.
6. **Generate `.env.lan`** — copies `.env.lan.example`, substitutes your LAN IP, and generates a unique random secret for every `__generated_at_install__` placeholder (DB password, Redis password, MinIO secret key, S3 secret key, Auth.js secret). The real `.env.lan` is gitignored and never leaves this machine.
7. **Render Caddyfile** — substitutes `${LAN_IP}` and `${COMPOSE_PROJECT_NAME}` into `deploy/compose/lan/Caddyfile.template` → `deploy/compose/lan/Caddyfile` (also gitignored).
8. **Start the stack** — runs `docker compose up -d` with all seven compose files in dependency order (db → cache → storage → worker → signaling → app → proxy).
9. **Health check** — polls `https://127.0.0.1/_pwbt/health` until the app responds 200.

### Installer flags

```
--ip <addr>        Override auto-detected LAN IP (e.g. if you have multiple interfaces)
--bundle <path>    Path to the image tarball (default: auto-detected from dist/yelli-lan-*.tar.gz)
--pubkey <path>    Path to the public key for signature verification
                   (default: deploy/lan/yelli-lan.pub)
--skip-verify      SKIP signature and checksum verification.
                   DEV / CI ONLY — NEVER use for production installs.
--skip-load        Skip loading images (if already loaded into Docker)
--force            Regenerate .env.lan secrets and TLS cert (e.g. after IP change)
--refresh-cert     Re-check the LAN IP, regenerate the cert if it changed, re-render
                   the Caddyfile, and reload Caddy — without a full reinstall.
                   Safe to run any time the host IP may have changed.
--down             Stop and remove the stack (volumes are preserved)
-h, --help         Show help
```

> **`--skip-verify` is a dev escape hatch only.** The installer prints a prominent warning banner when it is used. Do not distribute install instructions that include `--skip-verify`.

### Windows

Use the PowerShell wrapper:

```powershell
# From repo root in PowerShell (or Windows Terminal):
.\deploy\lan\install.ps1

# With flags:
.\deploy\lan\install.ps1 -ip 192.168.1.50 -force
.\deploy\lan\install.ps1 -refreshCert
.\deploy\lan\install.ps1 -down
```

The wrapper delegates to `install.sh` via Git-Bash if available. If Git-Bash is not installed, it falls back to a native PowerShell implementation.

---

## Step 3 — First Run

1. Open `https://<LAN-IP>` in a browser **on the host machine**.
2. Navigate to `https://<LAN-IP>/setup`.
3. Set your admin passphrase. It is stored as an Argon2id hash — not plaintext.
4. Log in and begin using Yelli.

---

## Accessing from Other LAN Devices

Other devices on the same network can open `https://<LAN-IP>` in their browser.

**"Connection not private" / cert warning on other devices:**

This warning appears because the mkcert root CA is only installed on the host machine. You have two options:

**Option A — Install the root CA (recommended for regular use):**

On the host machine, find the CA root:
```bash
mkcert -CAROOT    # prints the path, e.g. /home/user/.local/share/mkcert/
```

Copy `rootCA.pem` from that path to the other device. Then trust it:
- **Android**: Settings → Security → Install certificate → CA Certificate
- **iOS**: AirDrop the `.pem` file → Settings → General → VPN & Device Management → trust
- **Windows**: Double-click → Install Certificate → Local Machine → Trusted Root CA
- **macOS**: Keychain Access → drag in → right-click → Trust → Always Trust

**Option B — Accept the browser warning (quickest):**

Click "Advanced" → "Proceed to `<LAN-IP>` (unsafe)". Camera and microphone still work because the connection is still HTTPS — it's just not automatically trusted by the browser.

> Note: Option B may not work in all browsers for camera/mic on Android/iOS. Install the root CA for reliable access from mobile devices.

---

## LAN IP Change — Auto-Detection and Cert Reset

DHCP routers sometimes reassign the host PC's IP address.  When that happens the existing mkcert TLS certificate becomes invalid for the new IP — browsers will show a cert error and WebRTC / WSS features stop working.

### How auto-detection works

Every time `install.sh` (or `install.ps1`) runs, it:

1. Detects the current LAN IP (or uses `--ip` override).
2. Reads `certs/.cert-state` — a small file that records the IP the cert was last issued for and the issuance timestamp.
3. Compares the two:
   - **IP unchanged + valid cert present** → the cert is reused; mkcert is not called.
   - **IP changed (or no state yet, or cert missing)** → a prominent yellow banner is printed:

     ```
     ╔══════════════════════════════════════════════════════════════╗
     ║  ⚠  LAN IP CHANGED — TLS CERTIFICATE WILL BE REGENERATED   ║
     ║                                                              ║
     ║  Previous IP:  192.168.1.45                                  ║
     ║  New IP:       192.168.1.72                                  ║
     ║  ...                                                         ║
     ╚══════════════════════════════════════════════════════════════╝
     ```

     Then: regenerates the mkcert cert for the new IP, re-renders the Caddyfile, patches `.env.lan` in place (database secrets are **preserved**), updates `certs/.cert-state`, and brings the stack up (or reloads Caddy if using `--refresh-cert`).

### Where the cert state is stored

```
certs/.cert-state        # plain-text key=value; gitignored (inside certs/)
```

Contents example:
```
CERT_IP=192.168.1.72
CERT_ISSUED_AT=2026-06-14T08:23:11Z
```

The `certs/` directory is already gitignored — `.cert-state` is never committed.

### How to force a refresh without a full reinstall

Use the lightweight `--refresh-cert` flag (or the dedicated wrapper script):

```bash
# Option A — flag on install.sh (skips image load, skips .env.lan regeneration)
bash deploy/lan/install.sh --refresh-cert

# Option B — dedicated wrapper (identical behaviour, cleaner to remember)
bash deploy/lan/refresh-cert.sh

# Override IP if auto-detection picks the wrong interface
bash deploy/lan/refresh-cert.sh --ip 192.168.1.72
```

PowerShell (Windows):
```powershell
.\deploy\lan\install.ps1 -refreshCert
.\deploy\lan\install.ps1 -refreshCert -ip 192.168.1.72
```

The refresh path:
1. Detects the current IP and compares with `certs/.cert-state`.
2. Regenerates the cert if needed (or exits cleanly if unchanged).
3. Re-renders `deploy/compose/lan/Caddyfile`.
4. Patches `LAN_IP`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_SIGNALING_URL` in `.env.lan` (secrets untouched).
5. Runs `caddy reload` (or restarts the Caddy container as fallback) — **no full stack restart required**.

### After an IP change — other LAN devices

If other devices had previously trusted the mkcert root CA, the CA itself is unchanged — only the leaf cert is regenerated.  Other devices do **not** need to re-import the root CA.  They will simply connect to the new IP address as usual.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Camera / mic blocked | Not on HTTPS | Check you're using `https://` not `http://`. Never use HTTP for Yelli. |
| `ERR_CONNECTION_REFUSED` on `https://<LAN-IP>` | Caddy not running or firewall | Check `docker compose logs caddy`; open TCP 443 and 80 on the host firewall |
| `ERR_CERT_AUTHORITY_INVALID` on other devices | mkcert CA not trusted | Install root CA on the other device (see above) or accept the browser warning |
| WSS / real-time features not working | Signaling container unhealthy | `docker compose logs signaling`; check that the `/ws*` Caddy route is in the Caddyfile |
| App returns 502 | App container still starting | Wait 30–60s after `install.sh` finishes; check `docker compose logs app` |
| Blank / broken page after IP change | IP changed, cert/env stale | Run `bash deploy/lan/refresh-cert.sh` (or `install.sh --refresh-cert`) |
| "connection not private" on THIS machine | mkcert CA not installed | Run `mkcert -install` manually, then restart the browser |
| Secrets lost after accidental `--force` | `.env.lan` was regenerated | Restore from `.env.lan.bak.<timestamp>` left by the installer |
| `SHA-256 MISMATCH` error | Archive corrupted or wrong file | Re-download/re-copy the bundle; verify with `sha256sum -c *.sha256` |
| `Signature INVALID` error | Tampered archive or wrong public key | Discard the archive; request a fresh bundle from the owner |
| `Signature file not found` | `.sig` not transferred with the archive | Ensure all four output files travel together (see Step 1c) |
| `minisign not installed` error | Verification tool missing | Install minisign or gpg (see Prerequisites §3) |

### View logs

```bash
# All services
docker compose --env-file .env.lan \
  -f deploy/compose/lan/docker-compose.db.yml \
  -f deploy/compose/lan/docker-compose.cache.yml \
  -f deploy/compose/lan/docker-compose.storage.yml \
  -f deploy/compose/lan/docker-compose.worker.yml \
  -f deploy/compose/lan/docker-compose.signaling.yml \
  -f deploy/compose/lan/docker-compose.app.yml \
  -f deploy/compose/lan/docker-compose.proxy.yml \
  logs -f

# Single service
docker logs yelli_lan_app -f
```

---

## Security Notes

- **Signed bundles.** Every production bundle is signed by the owner's private key (minisign or GPG). The installer verifies the SHA-256 checksum and the signature before loading any Docker images. A tampered or corrupted archive is rejected at step 2.
- **Signing key is owner-held.** The private key is never generated, stored, or embedded by the tooling. Only the public key (`deploy/lan/yelli-lan.pub`) lives in the repo. See the [Signed Archive Distribution Model](#signed-archive-distribution-model) section for key management details.
- Secrets (`DB_PASSWORD`, `REDIS_PASSWORD`, `STORAGE_SECRET_KEY`, `AUTH_SECRET`, etc.) are generated locally by `install.sh` using `openssl rand`. They never leave the host machine.
- `.env.lan` and `certs/` are gitignored — they will never be accidentally committed.
- Only Caddy (ports 80 and 443) is exposed to the host network. Postgres, Valkey, MinIO, app, signaling, and worker containers have no host-port bindings — traffic stays on the Docker internal bridge network.
- If the LAN IP changes (e.g. DHCP lease), the installer auto-detects the change on every run and regenerates the cert + re-renders the Caddyfile automatically.  For a lightweight refresh without a full reinstall, run `bash deploy/lan/refresh-cert.sh` (or `install.sh --refresh-cert`).
- The mkcert root CA is only valid on machines where `mkcert -install` was run. It is a development-grade CA suitable for LAN/offline use but should not be used for public internet deployments.
- `--skip-verify` bypasses all bundle verification and should never appear in operator-facing install instructions.
