#!/bin/bash
# Reset the LAN Anonymous Admin passphrase on the host.
#
# Sets `Tenant.adminPassphraseHash` (Argon2id) on the implicit LAN tenant — the
# earliest-created tenant (LAN is single-tenant per deployment, Step 1). This is the
# host-operator recovery path referenced by apps/yelli/src/server/auth/lan-admin.ts
# when nobody can sign in (forgotten passphrase). The in-app `/setup` flow only ever
# sets the FIRST passphrase; this script (re)sets it unconditionally.
#
# Usage:
#   ./scripts/reset-admin-passphrase.sh [NEW_PASSPHRASE] [--env-file FILE]
#
#   NEW_PASSPHRASE   optional; if omitted you are prompted (hidden input, confirmed).
#   --env-file FILE  env file to load DATABASE_URL from (default: .env.dev).
#
# Safe + idempotent: re-running with the same passphrase re-hashes (Argon2id salt is
# random, so the stored hash differs but verifies the same). Never echoes the
# passphrase or the hash. pnpm isolates workspace deps, so argon2 (in @yelli/web) and
# the Prisma client (in @yelli/db) are each invoked from the package that owns them.

set -euo pipefail

# ── Resolve repo root (script lives in scripts/) ───────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ── Parse args ─────────────────────────────────────────────────────────────────
PASSPHRASE=""
ENV_FILE=".env.dev"
while [ $# -gt 0 ]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      [ -z "$ENV_FILE" ] && { echo "❌ --env-file requires a path"; exit 1; }
      shift 2
      ;;
    --env-file=*)
      ENV_FILE="${1#--env-file=}"
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      if [ -z "$PASSPHRASE" ]; then PASSPHRASE="$1"; else
        echo "❌ Unexpected argument: $1"; exit 1
      fi
      shift
      ;;
  esac
done

# ── Load env (DATABASE_URL) ────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Env file not found: $ENV_FILE (pass one with --env-file)"; exit 1
fi
# Export only assignments; ignore comments/blank lines. Never echo values.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set in $ENV_FILE"; exit 1
fi

# ── Acquire passphrase (hidden prompt + confirm if not supplied) ───────────────
if [ -z "$PASSPHRASE" ]; then
  printf 'New admin passphrase (hidden): ' >&2
  read -rs PASSPHRASE; echo >&2
  printf 'Confirm passphrase (hidden): ' >&2
  read -rs CONFIRM; echo >&2
  if [ "$PASSPHRASE" != "$CONFIRM" ]; then
    echo "❌ Passphrases don't match."; exit 1
  fi
fi
if [ "${#PASSPHRASE}" -lt 8 ]; then
  echo "❌ Passphrase must be at least 8 characters."; exit 1
fi

# ── Temp node helpers (written into the package that owns each dep) ─────────────
HASH_HELPER="$REPO_ROOT/apps/yelli/.reset-admin-hash.cjs"
UPDATE_HELPER="$REPO_ROOT/packages/db/.reset-admin-update.cjs"
cleanup() { rm -f "$HASH_HELPER" "$UPDATE_HELPER"; }
trap cleanup EXIT

cat > "$HASH_HELPER" <<'EOF'
// Hash the passphrase from stdin with Argon2id (matches lan-admin.ts `hash(...)`
// defaults) and print ONLY the hash to stdout. Runs in @yelli/web (owns @node-rs/argon2).
const { hash } = require('@node-rs/argon2');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', async () => {
  const passphrase = input.replace(/\n$/, '');
  try {
    process.stdout.write(await hash(passphrase));
  } catch (e) {
    process.stderr.write('hash failed: ' + (e && e.message) + '\n');
    process.exit(1);
  }
});
EOF

cat > "$UPDATE_HELPER" <<'EOF'
// Update the earliest-created tenant's adminPassphraseHash from the hash on stdin.
// Runs in @yelli/db (owns @prisma/client). Prints a tenant-id line on success.
const { PrismaClient } = require('@prisma/client');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', async () => {
  const adminPassphraseHash = input.trim();
  if (!adminPassphraseHash) {
    process.stderr.write('empty hash on stdin\n');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true },
    });
    if (!tenant) {
      process.stderr.write('no tenant found — nothing to reset\n');
      process.exit(2);
    }
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { adminPassphraseHash },
    });
    // Audit (AuditLog is L6-excluded base client; tenantId explicit — security.md #10).
    await prisma.auditLog
      .create({
        data: {
          tenantId: tenant.id,
          actorUserId: null,
          action: 'lan.admin.reset',
          targetType: 'Tenant',
          targetId: tenant.id,
          payload: { via: 'reset-admin-passphrase.sh' },
        },
      })
      .catch(() => {});
    process.stdout.write('TENANT=' + tenant.slug + '\n');
  } catch (e) {
    process.stderr.write('update failed: ' + (e && e.message) + '\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
});
EOF

# ── Hash, then update — each in its owning workspace package ────────────────────
echo "→ Hashing passphrase (Argon2id)…"
HASH="$(printf '%s' "$PASSPHRASE" | pnpm --filter @yelli/web exec node "$HASH_HELPER")"
if [ -z "$HASH" ]; then
  echo "❌ Hashing produced no output."; exit 1
fi

echo "→ Updating LAN tenant adminPassphraseHash via Prisma…"
RESULT="$(printf '%s' "$HASH" | DATABASE_URL="$DATABASE_URL" pnpm --filter @yelli/db exec node "$UPDATE_HELPER")"
TENANT_SLUG="${RESULT#TENANT=}"

echo "✅ Admin passphrase reset for LAN tenant '${TENANT_SLUG}'. Sign in at /admin/login."
