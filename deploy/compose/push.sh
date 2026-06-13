#!/usr/bin/env bash
# Manual image promotion pipeline
# Usage:
#   bash deploy/compose/push.sh dev       — build + tag + test + push dev image
#   bash deploy/compose/push.sh staging   — re-tag dev-latest → staging-*, push
#   bash deploy/compose/push.sh prod      — re-tag staging-latest → prod + prod-sha-*, push
#
# Prerequisites:
#   DOCKERHUB_USERNAME env var must be set (e.g. export DOCKERHUB_USERNAME=powerbyteit)
#   docker login must have been run at least once
#   docker.publish: true must be set in inputs.yml
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
IMAGE_BASE="${DOCKERHUB_USERNAME:?'DOCKERHUB_USERNAME env var is required. Run: export DOCKERHUB_USERNAME=powerbyteit'}/${IMAGE_NAME:-yelli}"
# Background BullMQ worker host (W5-runtime) — a separate image from the app.
WORKER_IMAGE_BASE="${DOCKERHUB_USERNAME}/${WORKER_IMAGE_NAME:-yelli-worker}"
SHORT_SHA=$(git rev-parse --short HEAD)

# ── Guard: docker.publish ────────────────────────────────────────────────────
if ! grep -q "publish: true" inputs.yml 2>/dev/null; then
  echo "❌  docker.publish is not set to 'true' in inputs.yml. Aborting." >&2
  exit 1
fi

# ── Guard: docker login ───────────────────────────────────────────────────────
if ! docker info 2>/dev/null | grep -q "Username"; then
  echo "❌  Not logged in to Docker Hub. Run: docker login" >&2
  exit 1
fi

TARGET="${1:-dev}"

case "$TARGET" in

  # ── DEV: build from source, run tests, push ──────────────────────────────
  dev)
    echo "🔨  Building dev image from source…"
    docker build \
      --file apps/yelli/Dockerfile \
      --tag "${IMAGE_BASE}:dev-latest" \
      --tag "${IMAGE_BASE}:dev-sha-${SHORT_SHA}" \
      --platform linux/amd64 \
      .

    echo "🔨  Building worker image from source…"
    docker build \
      --file packages/jobs/Dockerfile.workers \
      --tag "${WORKER_IMAGE_BASE}:dev-latest" \
      --tag "${WORKER_IMAGE_BASE}:dev-sha-${SHORT_SHA}" \
      --platform linux/amd64 \
      .

    echo "🧪  Starting dev stack for tests…"
    bash deploy/compose/start.sh dev up -d
    sleep 8

    echo "🧪  Running tests inside container…"
    if ! docker compose -f deploy/compose/dev/docker-compose.app.yml \
        exec -T app pnpm test --passWithNoTests; then
      echo "❌  Tests failed. Tearing down dev stack. Fix tests before pushing." >&2
      bash deploy/compose/start.sh dev down
      exit 1
    fi

    echo "🛑  Tearing down dev stack…"
    bash deploy/compose/start.sh dev down

    echo "📤  Pushing dev images to Docker Hub…"
    docker push "${IMAGE_BASE}:dev-latest"
    docker push "${IMAGE_BASE}:dev-sha-${SHORT_SHA}"
    docker push "${WORKER_IMAGE_BASE}:dev-latest"
    docker push "${WORKER_IMAGE_BASE}:dev-sha-${SHORT_SHA}"

    echo ""
    echo "✅  Dev images pushed:"
    echo "     ${IMAGE_BASE}:dev-latest"
    echo "     ${IMAGE_BASE}:dev-sha-${SHORT_SHA}"
    echo "     ${WORKER_IMAGE_BASE}:dev-latest"
    echo "     ${WORKER_IMAGE_BASE}:dev-sha-${SHORT_SHA}"
    echo ""
    echo "▶   To promote to staging: bash deploy/compose/push.sh staging"
    ;;

  # ── STAGING: re-tag dev-latest → staging-*, push ─────────────────────────
  staging)
    echo "🔁  Promoting dev images → staging…"
    docker pull "${IMAGE_BASE}:dev-latest"
    docker tag  "${IMAGE_BASE}:dev-latest" "${IMAGE_BASE}:staging-latest"
    docker tag  "${IMAGE_BASE}:dev-latest" "${IMAGE_BASE}:staging-sha-${SHORT_SHA}"
    docker push "${IMAGE_BASE}:staging-latest"
    docker push "${IMAGE_BASE}:staging-sha-${SHORT_SHA}"

    docker pull "${WORKER_IMAGE_BASE}:dev-latest"
    docker tag  "${WORKER_IMAGE_BASE}:dev-latest" "${WORKER_IMAGE_BASE}:staging-latest"
    docker tag  "${WORKER_IMAGE_BASE}:dev-latest" "${WORKER_IMAGE_BASE}:staging-sha-${SHORT_SHA}"
    docker push "${WORKER_IMAGE_BASE}:staging-latest"
    docker push "${WORKER_IMAGE_BASE}:staging-sha-${SHORT_SHA}"

    echo ""
    echo "✅  Staging images pushed:"
    echo "     ${IMAGE_BASE}:staging-latest"
    echo "     ${IMAGE_BASE}:staging-sha-${SHORT_SHA}"
    echo "     ${WORKER_IMAGE_BASE}:staging-latest"
    echo "     ${WORKER_IMAGE_BASE}:staging-sha-${SHORT_SHA}"
    echo ""
    echo "📋  On your staging server, run:"
    echo "     docker compose -f deploy/compose/stage/docker-compose.app.yml pull"
    echo "     docker compose -f deploy/compose/stage/docker-compose.app.yml up -d"
    echo ""
    echo "▶   To promote to prod: bash deploy/compose/push.sh prod"
    ;;

  # ── PROD: re-tag staging-latest → prod + prod-sha-*, push ─────────────────
  prod)
    echo "🚀  Promoting staging images → production…"
    docker pull "${IMAGE_BASE}:staging-latest"
    docker tag  "${IMAGE_BASE}:staging-latest" "${IMAGE_BASE}:prod"
    docker tag  "${IMAGE_BASE}:staging-latest" "${IMAGE_BASE}:prod-sha-${SHORT_SHA}"
    docker push "${IMAGE_BASE}:prod"
    docker push "${IMAGE_BASE}:prod-sha-${SHORT_SHA}"

    docker pull "${WORKER_IMAGE_BASE}:staging-latest"
    docker tag  "${WORKER_IMAGE_BASE}:staging-latest" "${WORKER_IMAGE_BASE}:prod"
    docker tag  "${WORKER_IMAGE_BASE}:staging-latest" "${WORKER_IMAGE_BASE}:prod-sha-${SHORT_SHA}"
    docker push "${WORKER_IMAGE_BASE}:prod"
    docker push "${WORKER_IMAGE_BASE}:prod-sha-${SHORT_SHA}"

    echo ""
    echo "✅  Production images pushed:"
    echo "     ${IMAGE_BASE}:prod"
    echo "     ${IMAGE_BASE}:prod-sha-${SHORT_SHA}"
    echo "     ${WORKER_IMAGE_BASE}:prod"
    echo "     ${WORKER_IMAGE_BASE}:prod-sha-${SHORT_SHA}"
    echo ""
    echo "📋  On your production server, run:"
    echo "     docker compose -f deploy/compose/prod/docker-compose.app.yml pull"
    echo "     docker compose -f deploy/compose/prod/docker-compose.app.yml up -d"
    echo ""
    echo "🔄  Rollback: change APP_IMAGE_TAG to prod-sha-{previous} in .env.prod,"
    echo "    then: docker compose -f deploy/compose/prod/docker-compose.app.yml up -d"
    ;;

  *)
    echo "Usage: bash deploy/compose/push.sh [dev|staging|prod]" >&2
    exit 1
    ;;

esac
