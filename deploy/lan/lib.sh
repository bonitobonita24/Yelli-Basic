#!/usr/bin/env bash
# deploy/lan/lib.sh — shared bash helpers for the Yelli LAN installer.
# Source this file; do not execute it directly.
#
# Usage:  source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

set -euo pipefail

# ─── Color / log helpers ─────────────────────────────────────────────────────

_tty() { [ -t 1 ] && printf '%s' "$1" || true; }

RED="$(_tty $'\033[0;31m')"
YLW="$(_tty $'\033[0;33m')"
GRN="$(_tty $'\033[0;32m')"
BLU="$(_tty $'\033[0;34m')"
RST="$(_tty $'\033[0m')"

info()  { printf '%s[INFO]%s  %s\n'  "$BLU" "$RST" "$*"; }
warn()  { printf '%s[WARN]%s  %s\n'  "$YLW" "$RST" "$*" >&2; }
err()   { printf '%s[ERR]%s   %s\n'  "$RED" "$RST" "$*" >&2; }
ok()    { printf '%s[OK]%s    %s\n'  "$GRN" "$RST" "$*"; }

# ─── OS detection ────────────────────────────────────────────────────────────

os_name() {
  case "$(uname -s 2>/dev/null)" in
    Linux*)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "wsl"
      else
        echo "linux"
      fi
      ;;
    Darwin*) echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows-gitbash" ;;
    *) echo "unknown" ;;
  esac
}

# ─── Prerequisite check ──────────────────────────────────────────────────────

# need_cmd <cmd> <install_hint>
# Prints per-OS install guidance and returns 1 if the command is missing.
need_cmd() {
  local cmd="$1"
  local hint="${2:-}"
  if command -v "$cmd" >/dev/null 2>&1; then
    return 0
  fi
  err "Required command not found: $cmd"
  if [ -n "$hint" ]; then
    printf '         %s\n' "$hint"
  fi
  return 1
}

# ─── LAN IP detection ────────────────────────────────────────────────────────

# detect_lan_ip — echoes the primary LAN IP of this machine.
# Honors LAN_IP env override (set before sourcing lib.sh or exporting in caller).
detect_lan_ip() {
  # Honor explicit override.
  if [ -n "${LAN_IP:-}" ]; then
    echo "$LAN_IP"
    return 0
  fi

  local ip=""

  # 1. Linux / WSL: ip route (most reliable)
  if command -v ip >/dev/null 2>&1; then
    ip=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ { for(i=1;i<=NF;i++) if($i=="src") { print $(i+1); exit } }')
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
  fi

  # 2. hostname -I (Linux fallback)
  if command -v hostname >/dev/null 2>&1; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ]; then echo "$ip"; return 0; fi
  fi

  # 3. macOS: ipconfig getifaddr
  if command -v ipconfig >/dev/null 2>&1 && [ "$(os_name)" = "macos" ]; then
    for iface in en0 en1 en2; do
      ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
      if [ -n "$ip" ]; then echo "$ip"; return 0; fi
    done
  fi

  # 4. ifconfig (macOS / BSD fallback)
  if command -v ifconfig >/dev/null 2>&1; then
    ip=$(ifconfig 2>/dev/null \
      | awk '/inet / && !/127\.0\.0\.1/ { gsub(/addr:/, "", $2); print $2; exit }')
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
  fi

  # 5. ipconfig (Windows Git-Bash fallback)
  if command -v ipconfig.exe >/dev/null 2>&1; then
    ip=$(ipconfig.exe 2>/dev/null \
      | awk '/IPv4/ { gsub(/\r/, ""); split($NF, a, "."); if(a[1]!="127") print $NF; exit }')
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
  fi

  err "Could not auto-detect LAN IP. Set LAN_IP=<your-ip> and re-run, or pass --ip <addr>."
  return 1
}

# ─── Secret generation ───────────────────────────────────────────────────────

# gen_secret <length>
# Generates a URL-safe random string of at least <length> characters.
gen_secret() {
  local len="${1:-48}"
  # Use openssl (preferred), fall back to /dev/urandom.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$((len * 2))" | tr -d '/+=\n' | cut -c1-"$len"
  else
    # Fallback: /dev/urandom + LC_ALL=C tr
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c "$len"
  fi
}
