#!/usr/bin/env bash
# deploy/lan/preflight.sh — verify prerequisites for the Yelli LAN installer.
#
# Checks: docker, docker compose v2, mkcert.
# Exits nonzero if any prerequisite is missing.
#
# Usage:
#   bash deploy/lan/preflight.sh
#   (also sourced/called by install.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

OS=$(os_name)

# ─── Install guidance per tool per OS ────────────────────────────────────────

_docker_hint() {
  case "$OS" in
    linux|wsl)
      cat <<'EOF'
  Install Docker Engine (Linux / WSL2):
    https://docs.docker.com/engine/install/
    Quick (Ubuntu/Debian):
      curl -fsSL https://get.docker.com | sh
      sudo usermod -aG docker $USER   # then log out & back in
    For WSL2 — Docker Desktop is easier:
      https://www.docker.com/products/docker-desktop/
EOF
      ;;
    macos)
      cat <<'EOF'
  Install Docker Desktop for Mac:
    https://www.docker.com/products/docker-desktop/
    Or via Homebrew:
      brew install --cask docker
EOF
      ;;
    windows-gitbash)
      cat <<'EOF'
  Install Docker Desktop for Windows:
    https://www.docker.com/products/docker-desktop/
  Ensure "Use WSL 2 based engine" is enabled in Docker Desktop settings.
EOF
      ;;
    *)
      echo "  See: https://docs.docker.com/engine/install/"
      ;;
  esac
}

_compose_hint() {
  case "$OS" in
    linux|wsl)
      cat <<'EOF'
  Docker Compose v2 (plugin) is included with Docker Desktop.
  For Docker Engine (non-Desktop), install the plugin:
    sudo apt-get update && sudo apt-get install docker-compose-plugin   # Debian/Ubuntu
    sudo dnf install docker-compose-plugin                              # RHEL/Fedora
  Or download the binary manually:
    https://docs.docker.com/compose/install/linux/
EOF
      ;;
    macos|windows-gitbash)
      echo "  Docker Compose v2 is bundled with Docker Desktop — install Docker Desktop first."
      ;;
    *)
      echo "  See: https://docs.docker.com/compose/install/"
      ;;
  esac
}

_mkcert_hint() {
  case "$OS" in
    linux|wsl)
      cat <<'EOF'
  Install mkcert (Linux / WSL2):
    # Install NSS tools (required for Firefox / Chrome trust):
    sudo apt install libnss3-tools   # Debian/Ubuntu
    sudo dnf install nss-tools       # RHEL/Fedora

    # Then download the mkcert binary:
    MKCERT_VERSION=$(curl -s https://api.github.com/repos/FiloSottile/mkcert/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
    curl -Lo /usr/local/bin/mkcert "https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/mkcert-${MKCERT_VERSION}-linux-amd64"
    chmod +x /usr/local/bin/mkcert

    # Or use the Snap package:
    sudo snap install mkcert
EOF
      ;;
    macos)
      cat <<'EOF'
  Install mkcert (macOS):
    brew install mkcert
    brew install nss   # optional, for Firefox support
EOF
      ;;
    windows-gitbash)
      cat <<'EOF'
  Install mkcert (Windows):
    # With Chocolatey:
    choco install mkcert
    # With Scoop:
    scoop bucket add extras
    scoop install mkcert
    # Or download the .exe from:
    #   https://github.com/FiloSottile/mkcert/releases
EOF
      ;;
    *)
      echo "  See: https://github.com/FiloSottile/mkcert#installation"
      ;;
  esac
}

# ─── Checks ──────────────────────────────────────────────────────────────────

FAILED=0

printf '\n══════════════════════════════════════════════════════\n'
printf ' Yelli LAN — Prerequisite Check\n'
printf '══════════════════════════════════════════════════════\n\n'

# 1. docker
printf '  Checking: docker ... '
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DOCKER_VERSION=$(docker --version 2>/dev/null | head -1)
  printf '%s\n' "${GRN}FOUND${RST} ($DOCKER_VERSION)"
else
  printf '%s\n' "${RED}MISSING${RST}"
  echo ""
  _docker_hint
  echo ""
  FAILED=1
fi

# 2. docker compose v2 (plugin — not legacy docker-compose)
printf '  Checking: docker compose v2 ... '
if docker compose version >/dev/null 2>&1; then
  COMPOSE_VERSION=$(docker compose version 2>/dev/null | head -1)
  printf '%s\n' "${GRN}FOUND${RST} ($COMPOSE_VERSION)"
else
  printf '%s\n' "${RED}MISSING${RST}"
  echo ""
  warn "  'docker compose' (v2 plugin) not found. The legacy 'docker-compose' (v1) is NOT supported."
  _compose_hint
  echo ""
  FAILED=1
fi

# 3. mkcert
printf '  Checking: mkcert ... '
if command -v mkcert >/dev/null 2>&1; then
  MKCERT_VERSION=$(mkcert --version 2>/dev/null || echo "unknown version")
  printf '%s\n' "${GRN}FOUND${RST} ($MKCERT_VERSION)"
else
  printf '%s\n' "${RED}MISSING${RST}"
  echo ""
  warn "  mkcert is required to mint a locally-trusted TLS certificate for the LAN IP."
  warn "  Without it, browsers will block camera/microphone access (requires HTTPS/secure context)."
  _mkcert_hint
  echo ""
  FAILED=1
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  printf '══════════════════════════════════════════════════════\n'
  ok " ALL PREREQUISITES PRESENT — ready to install."
  printf '══════════════════════════════════════════════════════\n\n'
  exit 0
else
  printf '══════════════════════════════════════════════════════\n'
  err " One or more prerequisites are missing. Install them and re-run."
  printf '══════════════════════════════════════════════════════\n\n'
  exit 1
fi
