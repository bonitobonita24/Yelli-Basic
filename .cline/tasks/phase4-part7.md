# Phase 4 Part 7 — tools/ + deploy/compose/ + SocratiCode artifacts (Yelli)
# Fresh session. Read STATE.md first. Confirm Part 5 complete (Part 6 skipped).
# Branch: scaffold/part-7. Never commit to main directly.

TASK: Generate governance tools + Docker Compose stacks + SocratiCode context artifacts (Part 7 of 8).

PRE-FLIGHT:
- Read .cline/STATE.md — confirm LAST_DONE shows Part 5 complete.
- Read inputs.yml: docker.*, ports.dev.*, tech_stack
- Read docs/DECISIONS_LOG.md: V27 Traefik labels (staging/prod), Komodo auto_update staging,
    cloudflared sidecar for current live deploy (yelli-maes.powerbyte.app), COMPOSE_PROJECT_NAME=yelli
- Read .cline/memory/lessons.md (ALL 🔴 gotchas first)
- Create scaffold/part-7 branch before writing any file

GENERATE:
tools/:
- validate-inputs.mjs — JSON Schema validation: inputs.yml against inputs.schema.json (node --input-type=module)
- check-env.mjs — all required env vars present per APP_ENV; exits non-zero if missing
- check-product-sync.mjs — PRODUCT.md ↔ inputs.yml field alignment + <private> tag leak scan (Rule 20)
- hydration-lint.mjs — warns on common SSR hydration mismatch patterns in src/app/

deploy/compose/ (per-env, all follow Rule 5 split-by-service-group):

DEV (deploy/compose/dev/):
  docker-compose.db.yml       — postgres:16-alpine + edoburu/pgbouncer; creates yelli_dev_network bridge
  docker-compose.cache.yml    — valkey/valkey:7-alpine; external: yelli_dev_network
  docker-compose.storage.yml  — minio/minio:latest; external: yelli_dev_network
  docker-compose.infra.yml    — mailhog/mailhog (SMTP dev); external: yelli_dev_network
  docker-compose.pgadmin.yml  — dpage/pgadmin4; external: yelli_dev_network
  docker-compose.app.yml      — build: + image: yelli:dev-latest (builds from source); ports host:${APP_PORT}
  pgadmin-servers.json        — pre-configured DB server (hostname = yelli_dev_postgres)

STAGING (deploy/compose/stage/):
  docker-compose.db.yml       — same structure, standard ports 5432/5433
  docker-compose.cache.yml    — standard port 6379
  docker-compose.storage.yml  — standard port 9000/9001
  docker-compose.pgadmin.yml  — standard port 5051
  docker-compose.app.yml      — image: ONLY (NO build: key); Traefik labels for HTTPS:
    networks: [yelli_staging_network, proxy]  (external proxy = Traefik network on srv709899)
    labels:
      traefik.enable=true
      traefik.http.routers.yelli_staging_app.rule=Host(`${APP_DOMAIN}`)
      traefik.http.routers.yelli_staging_app.entrypoints=websecure
      traefik.http.routers.yelli_staging_app.tls.certresolver=letsEncrypt
      traefik.http.services.yelli_staging_app.loadbalancer.server.port=3000
    No host ports: on app service (Traefik routes)
  pgadmin-servers.json

PROD (deploy/compose/prod/):
  Same structure as staging. COMPOSE_PROJECT_NAME=yelli_prod.
  APP_DOMAIN=yelli.app (from .env.prod). APP_IMAGE_TAG=prod.
  cloudflared sidecar reference: deploy/compose/prod/docker-compose.cloudflared.yml
    (carries forward existing yelli-maes.powerbyte.app tunnel config as migration asset)

ALL COMPOSE FILES:
  - env_file: ../../.env.${ENV} (never inline credentials)
  - container_name: ${COMPOSE_PROJECT_NAME}_<service>
  - volumes: ${COMPOSE_PROJECT_NAME}_<service>_data (named, isolated per env)
  - healthchecks on postgres, valkey, minio, app

deploy/compose/:
- start.sh — bash deploy/compose/start.sh [dev|stage|prod] [up -d|down|restart]
    dev up: passes --build to app service only; all others standard
- push.sh — image promotion: dev (build+test+push) → stage (re-tag+push) → prod (re-tag+push)
    guard: docker.publish check in inputs.yml; docker login check; tests must pass before push

COMMANDS.md (project root):
Full command reference: Docker start/stop/rebuild, clean/reset, image build+push,
database (pnpm db:migrate/seed/reset/studio), testing, code quality, governance tools,
git workflow, AI agent triggers, dev service URLs (from .env.dev ports), credentials lookup.

.socraticodecontextartifacts.json — MERGE (preserve design-system entry if Phase 2.6 created it):
  Add these 4 entries:
  - database-schema → ./packages/db/prisma/schema.prisma
  - implementation-map → ./docs/IMPLEMENTATION_MAP.md
  - decisions-log → ./docs/DECISIONS_LOG.md
  - product-definition → ./docs/PRODUCT.md

YELLI-SPECIFIC NOTES:
- cloudflared sidecar (yelli-maes.powerbyte.app tunnel) is a migration-retained asset.
  Do NOT delete or overwrite existing compose.yaml at project root if present.
  Mirror its tunnel config under deploy/compose/prod/docker-compose.cloudflared.yml for reference.
- Traefik on srv709899 has docker-provider broken (known gotcha in lessons.md).
  Sidestep pattern: cloudflared sidecar already handles routing for current live deploy.
  V27 Traefik labels are generated anyway for future migration / new server deployment.
- COMPOSE_PROJECT_NAME=yelli_dev / yelli_staging / yelli_prod (slug=yelli from inputs.yml)

EXECUTE:
  node tools/validate-inputs.mjs      # must exit 0
  node tools/check-env.mjs            # must exit 0 for dev
  bash deploy/compose/start.sh dev up -d
  # wait ~15s for healthchecks
  docker compose -f deploy/compose/dev/docker-compose.db.yml ps    # all healthy
  docker compose -f deploy/compose/dev/docker-compose.app.yml ps   # healthy
  bash deploy/compose/start.sh dev down

GOVERNANCE SELF-CHECK before merge:
  □ STATE.md rewritten: PHASE="Phase 4 Part 7 complete"
  □ CHANGELOG_AI.md entry: Agent: CLAUDE_CODE, Part 7 files listed
  □ .socraticodecontextartifacts.json has 4 (or 5 with design-system) entries

COMMIT + MERGE:
  git add -A
  git commit -m "scaffold(tools+deploy): governance tools + compose stacks + SocratiCode — Part 7 of 8"
  # squash-merge scaffold/part-7 to main; delete branch

OUTPUT:
"✅ Part 7 complete. Open phase4-part8.md in a NEW Claude Code session."

STOP HERE. Do not start Part 8 in this session.
