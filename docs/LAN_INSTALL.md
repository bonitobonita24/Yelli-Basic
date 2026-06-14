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

**Install these two tools BEFORE running the installer. They are the ONLY install dependencies.**

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
bash deploy/lan/bundle.sh
```

This:
- Pulls the four third-party images (`postgres:16-alpine`, `valkey/valkey:7-alpine`, `minio/minio:latest`, `caddy:2-alpine`).
- Saves all seven images into `dist/yelli-lan-images.tar.gz`.
- Writes `dist/yelli-lan-images.manifest.txt` with image digests and a SHA256 of the bundle.

Options:
```bash
bash deploy/lan/bundle.sh --skip-pull   # Use locally cached third-party images
bash deploy/lan/bundle.sh --out-dir /tmp/bundle
```

### 1c. Transfer to the target PC

Copy both `dist/yelli-lan-images.tar.gz` and the entire repo to the target PC (USB drive, local network transfer, etc.). The target PC does not need internet.

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
2. **Load images** — `docker load -i dist/yelli-lan-images.tar.gz`.
3. **Detect LAN IP** — reads your primary network interface IP. Override with `--ip <addr>`.
4. **mkcert** — installs the local CA (`mkcert -install`) then mints `certs/lan.pem` + `certs/lan-key.pem` for your LAN IP, `localhost`, and `127.0.0.1`. The `certs/` folder is gitignored.
5. **Generate `.env.lan`** — copies `.env.lan.example`, substitutes your LAN IP, and generates a unique random secret for every `__generated_at_install__` placeholder (DB password, Redis password, MinIO secret key, S3 secret key, Auth.js secret). The real `.env.lan` is gitignored and never leaves this machine.
6. **Render Caddyfile** — substitutes `${LAN_IP}` and `${COMPOSE_PROJECT_NAME}` into `deploy/compose/lan/Caddyfile.template` → `deploy/compose/lan/Caddyfile` (also gitignored).
7. **Start the stack** — runs `docker compose up -d` with all seven compose files in dependency order (db → cache → storage → worker → signaling → app → proxy).
8. **Health check** — polls `https://127.0.0.1/api/health` until the app responds 200.

### Installer flags

```
--ip <addr>      Override auto-detected LAN IP (e.g. if you have multiple interfaces)
--bundle <path>  Path to the image tarball (default: dist/yelli-lan-images.tar.gz)
--skip-load      Skip loading images (if already loaded into Docker)
--force          Regenerate .env.lan secrets and TLS cert (e.g. after IP change)
--down           Stop and remove the stack (volumes are preserved)
-h, --help       Show help
```

### Windows

Use the PowerShell wrapper:

```powershell
# From repo root in PowerShell (or Windows Terminal):
.\deploy\lan\install.ps1

# With flags:
.\deploy\lan\install.ps1 -ip 192.168.1.50 -force
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

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Camera / mic blocked | Not on HTTPS | Check you're using `https://` not `http://`. Never use HTTP for Yelli. |
| `ERR_CONNECTION_REFUSED` on `https://<LAN-IP>` | Caddy not running or firewall | Check `docker compose logs caddy`; open TCP 443 and 80 on the host firewall |
| `ERR_CERT_AUTHORITY_INVALID` on other devices | mkcert CA not trusted | Install root CA on the other device (see above) or accept the browser warning |
| WSS / real-time features not working | Signaling container unhealthy | `docker compose logs signaling`; check that the `/ws*` Caddy route is in the Caddyfile |
| App returns 502 | App container still starting | Wait 30–60s after `install.sh` finishes; check `docker compose logs app` |
| Blank / broken page after IP change | `NEXT_PUBLIC_SIGNALING_URL` stale | Re-run `install.sh --force` to regenerate the cert + env for the new IP |
| "connection not private" on THIS machine | mkcert CA not installed | Run `mkcert -install` manually, then restart the browser |
| Secrets lost after accidental `--force` | `.env.lan` was regenerated | Restore from `.env.lan.bak.<timestamp>` left by the installer |

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

- Secrets (`DB_PASSWORD`, `REDIS_PASSWORD`, `STORAGE_SECRET_KEY`, `AUTH_SECRET`, etc.) are generated locally by `install.sh` using `openssl rand`. They never leave the host machine.
- `.env.lan` and `certs/` are gitignored — they will never be accidentally committed.
- Only Caddy (ports 80 and 443) is exposed to the host network. Postgres, Valkey, MinIO, app, signaling, and worker containers have no host-port bindings — traffic stays on the Docker internal bridge network.
- If the LAN IP changes (e.g. DHCP lease), the mkcert cert and `NEXT_PUBLIC_SIGNALING_URL` become stale. Re-run `install.sh --force` to regenerate both.
- The mkcert root CA is only valid on machines where `mkcert -install` was run. It is a development-grade CA suitable for LAN/offline use but should not be used for public internet deployments.
