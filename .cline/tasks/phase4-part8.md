# Phase 4 Part 8 — CI + governance + MANIFEST + SocratiCode index (Yelli)
# Fresh session. Read STATE.md first. Confirm Part 7 complete.
# Branch: scaffold/part-8. Never commit to main directly.

TASK: Generate CI workflows + finalize governance + index codebase (Part 8 of 8).

PRE-FLIGHT:
- Read .cline/STATE.md — confirm LAST_DONE shows Part 7 complete.
- Read ALL 9 governance docs (full read — final governance sweep requires complete context).
- Read inputs.yml: docker.*, git.*, models.*
- Read docs/DECISIONS_LOG.md: Step 7 prod tag scheme (:vX.Y.Z + floating :prod), Step 9 observability
- Read .cline/memory/lessons.md (ALL 🔴 gotchas + ALL 🟤 decisions)
- Create scaffold/part-8 branch before writing any file

GENERATE:
.github/workflows/ci.yml:
  concurrency: cancel-in-progress on same branch
  permissions: contents: read
  jobs:
    governance:   validate-inputs + check-env + check-product-sync (private tag leak gate)
    quality:      matrix: [lint, typecheck, test, build] — depends-on: governance
    security:     pnpm audit --audit-level=high — blocks on HIGH/CRITICAL CVE; depends-on: governance
  All jobs: node 24, pnpm, corepack enable (CI Linux root — safe), frozen-lockfile, turbo cache

.github/workflows/docker-publish.yml:
  Trigger: push to main + workflow_dispatch
  concurrency: cancel-in-progress
  Multi-platform: linux/amd64 + linux/arm64
  Tags pushed per run:
    :staging-latest     (Komodo staging auto-update polls this)
    :latest             (manual prod deploy from Komodo UI)
    :sha-{short}        (immutable per-commit, used for pinned rollbacks)
    :vX.Y.Z             (semver tags from git tags — Step 7 tag scheme)
  Secrets required: DOCKERHUB_USERNAME + DOCKERHUB_TOKEN
  Var required: DOCKER_IMAGE_NAME (=yelli in GitHub repo Variables)
  Image: ${DOCKERHUB_USERNAME}/yelli

.github/workflows/release.yml (NEW — Step 7 prod tag scheme):
  Trigger: push of tags matching v*.*.* (e.g. git tag v1.0.0 && git push --tags)
  Builds prod-grade image, pushes :vX.Y.Z + :prod (floating alias for latest release)
  Enables rollback without rebuild: change APP_IMAGE_TAG=v1.0.0 in .env.prod → komodo redeploy

Final governance docs:
- CHANGELOG_AI.md — Phase 4 complete entry (all 8 Parts, files count, Agent: CLAUDE_CODE)
- IMPLEMENTATION_MAP.md — full snapshot: what is built, per-Part summary, tech stack confirmed
- DECISIONS_LOG.md — add locked entries:
    Docker image publishing: powerbyteit/yelli, tags :vX.Y.Z + :prod + :staging-latest + :sha-{short}
    CI matrix: lint/typecheck/test/build parallel, security audit blocking on HIGH/CRITICAL
    Phase 4 complete: all 8 Parts squash-merged to main

MANIFEST.txt (project root):
  List EVERY file generated across Parts 1-8 (relative paths, grouped by Part).
  Format: one file per line, prefixed with the Part that created it.

SocratiCode initial index:
  codebase_index {}          # trigger indexing
  # poll codebase_status {} until state: "ready"
  codebase_context_index {}  # index the 5 context artifacts from .socraticodecontextartifacts.json

ALL 9 PHASE 5 VALIDATION COMMANDS (run now — Part 8 is the pre-Phase-5 gate):
  pnpm install --frozen-lockfile
  pnpm tools:validate-inputs
  pnpm tools:check-env
  pnpm tools:check-product-sync
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  pnpm audit --audit-level=high

All 9 must pass (or HIGH CVE mitigated per DECISIONS_LOG) before merge.

GOVERNANCE SELF-CHECK before merge:
  □ CHANGELOG_AI.md: Phase 4 complete entry present with this session's timestamp
  □ IMPLEMENTATION_MAP.md: reflects all 8 Parts + current build state
  □ MANIFEST.txt: exists at project root, lists all generated files
  □ STATE.md: PHASE="Phase 4 Part 8 complete (all 8 Parts done)", NEXT="Start Phase 5"
  □ .github/workflows/ci.yml, docker-publish.yml, release.yml: all present

COMMIT + MERGE:
  git add -A
  git commit -m "scaffold(ci+governance): CI workflows + IMPLEMENTATION_MAP + MANIFEST — Part 8 of 8"
  # squash-merge scaffold/part-8 to main; delete branch

OUTPUT:
"✅ Phase 4 complete — all 8 Parts scaffolded and merged.

Say 'Start Phase 5' in a NEW Claude Code session to begin validation."

STOP HERE. Do not auto-trigger Phase 5. Human must trigger explicitly per Rule 24.
