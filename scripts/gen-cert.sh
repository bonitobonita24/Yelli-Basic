#!/usr/bin/env bash
# Generate a self-signed cert for local HTTPS.
# server.js auto-detects certs/cert.pem + certs/key.pem and switches to HTTPS.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p certs

# Collect local IPv4 addresses (skip loopback) so the cert is valid on the LAN too.
ips=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' || true)
san="DNS:localhost,IP:127.0.0.1"
for ip in $ips; do san="${san},IP:${ip}"; done

echo "SAN entries: ${san}"
echo "(Re-run this script if your Windows host's LAN IP changes.)"
echo

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/key.pem -out certs/cert.pem \
  -days 365 \
  -subj "/CN=intercom" \
  -addext "subjectAltName=${san}" \
  2>/dev/null

chmod 600 certs/key.pem
echo "Wrote certs/cert.pem + certs/key.pem"
echo
echo "Start the server with:  PORT=40333 node server.js"
echo "(server auto-switches to HTTPS when certs/ is present)"
