#!/usr/bin/env bash
# Expose the local intercom over a trusted HTTPS tunnel.
# Useful when LAN devices choke on the self-signed cert, or when you want
# to call someone outside the LAN.
#
# Tries: cloudflared → localtunnel → ngrok (whichever is installed first).
# The server is reached via http://localhost:$PORT — the tunnel terminates TLS
# at the provider's edge, so the local server stays plain.
#
# Usage:
#   PORT=40333 ./scripts/tunnel.sh                 # auto-pick a backend
#   PORT=40333 ./scripts/tunnel.sh cloudflared     # force one
set -euo pipefail

PORT="${PORT:-40333}"
backend="${1:-auto}"

echo "Tunneling local port ${PORT} to a public HTTPS URL…"
echo "(Run the server WITHOUT TLS for this: temporarily move certs/ aside,"
echo " or generate without certs in the first place.)"
echo

try_cloudflared() { command -v cloudflared >/dev/null && cloudflared tunnel --url "http://localhost:${PORT}"; }
try_localtunnel() { command -v lt          >/dev/null && lt --port "${PORT}"; }
try_ngrok()       { command -v ngrok       >/dev/null && ngrok http "${PORT}"; }

case "${backend}" in
  cloudflared) try_cloudflared ;;
  localtunnel|lt) try_localtunnel ;;
  ngrok) try_ngrok ;;
  auto)
    try_cloudflared || try_localtunnel || try_ngrok || {
      cat <<EOF
No tunnel CLI found. Install one:
  cloudflared:  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
                (no account needed for ephemeral --url tunnels)
  localtunnel:  npm i -g localtunnel
                (no account, random subdomain on loca.lt)
  ngrok:        https://ngrok.com/download
                (free account + auth token required)
EOF
      exit 1
    }
    ;;
  *) echo "Unknown backend: ${backend}" >&2; exit 2 ;;
esac
