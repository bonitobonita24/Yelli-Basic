#!/usr/bin/env bash
# deploy/lan/refresh-cert.sh — Lightweight IP-change / cert-refresh helper.
#
# Run this any time you suspect the host's LAN IP has changed (e.g. after a
# DHCP reassignment, router restart, or network reconfiguration).  It:
#
#   1. Detects the current LAN IP.
#   2. Compares it against the IP the existing cert was issued for
#      (stored in certs/.cert-state).
#   3. If the IP has changed (or the cert is missing):
#        - Prints a prominent notice showing old IP → new IP.
#        - Regenerates the mkcert TLS certificate for the new IP.
#        - Re-renders the Caddyfile.
#        - Updates .env.lan in-place (secrets preserved).
#        - Reloads Caddy so the new cert is served immediately.
#   4. If the IP is unchanged and the cert is valid — exits cleanly, no-op.
#
# Usage (from repo root):
#   bash deploy/lan/refresh-cert.sh [--ip <addr>]
#
# Pass --ip to override the auto-detected IP (same as install.sh --ip).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec bash "$SCRIPT_DIR/install.sh" --refresh-cert "$@"
