#!/usr/bin/env bash
# Usage: bash deploy/compose/start.sh [dev|stage|prod] [up -d|down|restart|ps|logs ...]
# All compose files run as ONE project via multiple -f flags so depends_on works across files.
# Dev: rebuilds app image from source on every "up" (docker.dev_build=true).
# Stage/Prod: pulls pre-built image from Docker Hub — never builds from source.
set -euo pipefail

ENV="${1:-dev}"
shift || true
CMD="${*:-up -d}"

# Validate ENV
case "$ENV" in
  dev|stage|prod) ;;
  *) echo "❌  Unknown environment: '$ENV'. Valid: dev | stage | prod" >&2; exit 1 ;;
esac

# Guard: env file must exist so YAML variable substitution works at compose-parse time.
# Absolute path so --env-file resolves correctly regardless of CWD inside docker compose.
ENV_FILE="$(pwd)/.env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌  .env.$ENV not found. Copy .env.example → .env.$ENV and fill values first." >&2
  echo "   (Or run: bash scripts/sync-credentials-to-env.sh)" >&2
  exit 1
fi

BASE="deploy/compose/$ENV"

# Build -f flag list — all files in one project so depends_on works across files.
FILES=()

# 1. DB first (creates the shared bridge network)
[ -f "$BASE/docker-compose.db.yml" ]      && FILES+=("-f" "$BASE/docker-compose.db.yml")
# 2. Cache
[ -f "$BASE/docker-compose.cache.yml" ]   && FILES+=("-f" "$BASE/docker-compose.cache.yml")
# 3. Storage
[ -f "$BASE/docker-compose.storage.yml" ] && FILES+=("-f" "$BASE/docker-compose.storage.yml")
# 4. pgAdmin
[ -f "$BASE/docker-compose.pgadmin.yml" ] && FILES+=("-f" "$BASE/docker-compose.pgadmin.yml")
# 5. Infra (MailHog) — dev only
if [ "$ENV" = "dev" ]; then
  [ -f "$BASE/docker-compose.infra.yml" ] && FILES+=("-f" "$BASE/docker-compose.infra.yml")
fi
# 6. App
[ -f "$BASE/docker-compose.app.yml" ]     && FILES+=("-f" "$BASE/docker-compose.app.yml")
# 7. Signaling WS server (W2b) — after app
[ -f "$BASE/docker-compose.signaling.yml" ] && FILES+=("-f" "$BASE/docker-compose.signaling.yml")
# 8. Cloudflared sidecar — prod only (optional)
if [ "$ENV" = "prod" ]; then
  [ -f "$BASE/docker-compose.cloudflared.yml" ] && FILES+=("-f" "$BASE/docker-compose.cloudflared.yml")
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "❌  No compose files found under $BASE/" >&2
  exit 1
fi

PROJECT_NAME="yelli_$ENV"

# Dev up: add --build so app image rebuilds from source every time
EXTRA_ARGS=()
if [ "$ENV" = "dev" ] && [[ "$CMD" == up* ]]; then
  EXTRA_ARGS+=("--build")
fi

echo "▶  docker compose -p $PROJECT_NAME ${FILES[*]} $CMD${EXTRA_ARGS:+ ${EXTRA_ARGS[*]}}"
docker compose --env-file "$ENV_FILE" -p "$PROJECT_NAME" "${FILES[@]}" $CMD ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}

echo "✅  $ENV stack: $CMD complete"
