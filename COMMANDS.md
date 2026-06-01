# Yelli — Command Reference

All commands run from the project root (WSL2 terminal) unless noted otherwise.
`ENV` = dev | stage | prod. Actual port values are in `.env.dev` — see the Utilities section.

---

## Docker — Start / Stop / Rebuild

| Command | What it does |
|---|---|
| `bash deploy/compose/start.sh dev up -d` | Start all dev services (DB + cache + storage + pgAdmin + MailHog + app). App rebuilds from source. |
| `bash deploy/compose/start.sh dev down` | Stop all dev services (containers removed, volumes preserved). |
| `bash deploy/compose/start.sh dev restart` | Restart all dev services. |
| `bash deploy/compose/start.sh dev ps` | Show status of all dev containers. |
| `bash deploy/compose/start.sh dev logs` | Tail logs for all dev services. |
| `bash deploy/compose/start.sh stage up -d` | Start staging services (pulls image from Docker Hub). |
| `bash deploy/compose/start.sh prod up -d` | Start production services (pulls image from Docker Hub). |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml logs -f` | Tail app logs in real time. |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml logs -f app` | Tail app container logs only. |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml ps` | Check app service health. |
| `docker compose -f deploy/compose/dev/docker-compose.db.yml ps` | Check DB + PgBouncer health. |

---

## Docker — Clean / Clear / Reset

> ⚠ These commands are destructive. Read carefully before running.

| Command | What it does | Data lost? |
|---|---|---|
| `bash deploy/compose/start.sh dev down` | Stop + remove containers | ❌ No (volumes kept) |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml down --volumes` | Stop app + remove its volumes | ✅ YES |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml build --no-cache` | Rebuild app image from scratch | ❌ No |
| `docker builder prune -f` | Remove dangling build cache | ❌ No |
| `docker builder prune -a -f` | Remove ALL build cache (free disk) | ❌ No |
| `docker system prune -f` | Remove stopped containers + dangling images + cache | ❌ No |
| `docker system prune -a -f` | Remove ALL unused images + containers + cache | ❌ No |
| `docker system prune -a -f --volumes` | Remove everything including volumes | ✅ YES — all data |
| `docker volume rm yelli_dev_postgres_data` | Remove dev PostgreSQL volume | ✅ YES — dev DB |
| `docker volume rm yelli_dev_valkey_data` | Remove dev Valkey volume | ✅ YES — dev cache |
| `docker volume rm yelli_dev_minio_data` | Remove dev MinIO volume | ✅ YES — dev files |
| `docker volume ls` | List all Docker volumes | — |
| `docker image ls` | List all Docker images | — |
| `docker image prune -f` | Remove dangling images | ❌ No |

**Full dev environment reset (nuclear — wipes all dev data and rebuilds):**
```bash
bash deploy/compose/start.sh dev down --volumes   # stop + remove volumes
docker builder prune -f                            # clear build cache
bash deploy/compose/start.sh dev up -d             # rebuild + restart
pnpm db:migrate                                    # re-run migrations
pnpm db:seed                                       # re-seed (creates webmaster account)
```

---

## Docker — Image Build & Push (Manual Pipeline)

| Command | What it does |
|---|---|
| `export DOCKERHUB_USERNAME=powerbyteit` | Set Docker Hub username before pushing |
| `bash deploy/compose/push.sh dev` | Build from source, run tests, push dev tags |
| `bash deploy/compose/push.sh staging` | Re-tag dev-latest → staging-*, push |
| `bash deploy/compose/push.sh prod` | Re-tag staging-latest → prod + prod-sha-*, push |
| `docker pull powerbyteit/yelli:staging-latest` | Pull staging image on staging server |
| `docker pull powerbyteit/yelli:prod` | Pull prod image on production server |

**Tag format:**
- `:dev-latest` — latest dev build (mutable)
- `:dev-sha-{hash}` — specific dev commit (immutable)
- `:staging-latest` — promoted to staging (mutable)
- `:staging-sha-{hash}` — specific staging commit (immutable)
- `:prod` — current production (mutable)
- `:prod-sha-{hash}` — specific production commit (immutable)

**Rollback:** Change `APP_IMAGE_TAG` in `.env.prod` to a previous `prod-sha-{hash}`, then:
```bash
docker compose -f deploy/compose/prod/docker-compose.app.yml up -d
```

---

## Database

| Command | What it does |
|---|---|
| `pnpm db:migrate` | Run all pending Prisma migrations |
| `pnpm db:generate` | Regenerate Prisma client after schema change |
| `pnpm db:seed` | Run seed script — creates webmaster account + demo data |
| `pnpm db:reset` | Drop + recreate + migrate + seed (**dev only** — destroys all dev data) |
| `pnpm db:studio` | Open Prisma Studio at http://localhost:5555 (visual DB browser) |
| `pnpm db:migrate --create-only` | Create migration file without running it |
| `pnpm db:migrate deploy` | Run migrations on staging/prod (safe — no data loss) |

**First admin account** (created by `pnpm db:seed`):

| Field | Value |
|---|---|
| Username | `webmaster` |
| Password | See `CREDENTIALS.md` under "First Admin Account" |
| URL | http://localhost:[APP_PORT]/login |

⚠ Change the webmaster password immediately after first production login.

---

## Testing

| Command | What it does |
|---|---|
| `pnpm test` | Run all tests (unit + integration) |
| `pnpm test --watch` | Watch mode — re-runs on file change |
| `pnpm test --coverage` | With coverage report |
| `pnpm test --passWithNoTests` | No-fail if no test files yet |

---

## Code Quality

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint across all packages |
| `pnpm lint --fix` | Auto-fix lint issues |
| `pnpm typecheck` | TypeScript type check (tsc --noEmit) |
| `pnpm format` | Prettier format all files |
| `pnpm build` | Full production build via Turborepo |
| `pnpm audit --audit-level=high` | Dependency CVE scan |
| `pnpm audit --fix` | Auto-fix CVEs where possible |

---

## Governance & Validation

| Command | What it does |
|---|---|
| `pnpm tools:validate-inputs` | Validate inputs.yml against schema |
| `pnpm tools:check-env` | Check all required env vars are set |
| `pnpm tools:check-product-sync` | Validate PRODUCT.md ↔ inputs.yml alignment + private tag check |
| `pnpm tools:hydration-lint` | Check for SSR hydration mismatches |

---

## Git Workflow (Rule 23)

| Command | What it does |
|---|---|
| `git checkout -b feat/{slug}` | Create feature branch before any work |
| `git add -A && git commit -m "feat(module): description"` | Atomic conventional commit |
| `git checkout main && git merge --squash feat/{slug}` | Squash-merge to main |
| `git branch -d feat/{slug}` | Delete feature branch after merge |
| `git rev-parse --short HEAD` | Get short SHA (used in image tags) |

---

## AI Agent Triggers

| Say in Claude Code | What it does |
|---|---|
| `Feature Update` | Start Phase 7 — implement a PRODUCT.md change |
| `Start Phase 8` | Begin iterative buildout loop |
| `Resume Session` + 3 docs | Resume from STATE.md position |
| `Governance Sync` + 9 docs | Reconcile code ↔ governance docs |
| `Governance Retro` | Run retrospective on last session |
| `Re-run Phase 2.7` | Re-run spec stress-test |

---

## Dev Services — URLs

| Service | URL | Notes |
|---|---|---|
| App | http://localhost:[APP_PORT] | Check `.env.dev` for actual port |
| pgAdmin | http://localhost:[PGADMIN_PORT] | DB browser — credentials in `.env.dev` |
| MinIO Console | http://localhost:[STORAGE_CONSOLE_PORT] | File storage UI — credentials in `.env.dev` |
| MailHog | http://localhost:[SMTP_UI_PORT] | Dev email inbox — no auth |
| Prisma Studio | http://localhost:5555 | Visual DB browser (`pnpm db:studio`) |

```bash
# See all assigned ports at once
cat .env.dev | grep _PORT
```

---

## Credentials & Secrets

| Command | What it does |
|---|---|
| `cat CREDENTIALS.md` | View all credentials (gitignored — safe locally) |
| `grep -i password CREDENTIALS.md` | Quick password lookup |
| `openssl rand -base64 32 \| tr -d '\n' \| head -c 22` | Generate 22-char mixed password |
| `openssl rand -base64 64 \| tr -d '\n' \| head -c 48` | Generate 48-char signing secret |
| `git status \| grep CREDENTIALS` | Verify CREDENTIALS.md is NOT tracked by git |
| `git rm --cached CREDENTIALS.md` | Untrack CREDENTIALS.md if accidentally committed |

> ⚠ CREDENTIALS.md is gitignored. Anyone cloning the repo will NOT see it.

---

## Utilities

| Command | What it does |
|---|---|
| `cat .env.dev \| grep _PORT` | List all assigned dev ports |
| `docker stats` | Live CPU/memory/network stats for all containers |
| `docker exec -it yelli_dev_postgres psql -U ${DB_USER} -d ${DB_NAME}` | Open PostgreSQL shell |
| `docker exec -it yelli_dev_valkey valkey-cli -a ${REDIS_PASSWORD}` | Open Valkey CLI |
| `docker logs yelli_dev_app --tail 100` | Last 100 lines of app logs |
| `docker inspect yelli_dev_app \| grep IPAddress` | Get container IP address |
| `pnpm --filter @yelli/yelli dev` | Start only the web app (no Docker) |
| `pnpm turbo run build --filter=@yelli/yelli` | Build only the web app |
| `git log --oneline -10` | Last 10 commits |
| `git rev-parse --short HEAD` | Current commit short SHA |

---

## Common Full Workflow

```bash
# 1. Start dev environment
bash deploy/compose/start.sh dev up -d

# 2. Develop + test locally
pnpm test && pnpm typecheck && pnpm lint

# 3. Push dev image to Docker Hub
export DOCKERHUB_USERNAME=powerbyteit
bash deploy/compose/push.sh dev

# 4. Promote to staging
bash deploy/compose/push.sh staging
# On staging server:
#   docker compose -f deploy/compose/stage/docker-compose.app.yml pull
#   docker compose -f deploy/compose/stage/docker-compose.app.yml up -d

# 5. Promote to production (after verifying staging)
bash deploy/compose/push.sh prod
# On prod server:
#   docker compose -f deploy/compose/prod/docker-compose.app.yml pull
#   docker compose -f deploy/compose/prod/docker-compose.app.yml up -d
```
