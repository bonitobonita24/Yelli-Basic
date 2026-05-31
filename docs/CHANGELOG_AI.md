# CHANGELOG_AI

## 2026-05-31 — PRODUCT.md Reverse-Extraction (SITUATION D)
- Agent:              HUMAN (via Planning Assistant on Claude.ai)
- Why:                Existing Yelli LAN MVP (vanilla Node + ws + WebRTC) needed Spec-Driven V31 framework adoption without rebuilding code. SITUATION D recipe (Prompt 4.14) used to reverse-extract PRODUCT.md from existing app + new requirements.
- Files added:        docs/PRODUCT.md (621 lines, all 11 required sections + 13 extras)
                      docs/DESIGN.md (576 lines, Clay aesthetic + Mobile-First Principles)
                      docs/MOCKUP.jsx (1337 lines, Tier 1 screens at 375px baseline)
- Files modified:     none
- Files deleted:      none
- Schema/migrations:  none
- Errors encountered: none
- Errors resolved:    none
- Notes:              Steps 1-9 locked in series 2026-05-30 → 2026-05-31. Step 10 (Mobile-First global contract) locked post-audit 2026-05-31. Phase 2.6 (DESIGN.md) and 2.8 (mockup) SATISFIED via SITUATION D exception (existing public/index.html is the reference). AlphaTest/ promoted to project root 2026-05-30.

## 2026-06-01 — Spec-Driven V31 Brownfield Adoption (Prompt 1.5.4)
- Agent:              CLAUDE_CODE (Opus 4.7 Architect; Sonnet 4.6 Executor per V32 R1)
- Why:                Adopt Spec-Driven Platform V31 governance + state scaffold without rebuilding code (1.5.4 Adoption-mode Bootstrap). Pre-existing server.js (385L), public/index.html (47KB), compose.yaml, Dockerfile, deploy/ — attributed to HUMAN, retained as reference for Phase 4 Part 1 rewrite.
- Files added:        docs/DECISIONS_LOG.md, docs/CHANGELOG_AI.md (this file), docs/IMPLEMENTATION_MAP.md, project.memory.md, inputs.yml, inputs.schema.json, .cline/memory/lessons.md, .cline/memory/agent-log.md, .cline/STATE.md
- Files modified:     none (NEVER-TOUCH guard verified by deploy-v31.sh)
- Files deleted:      none
- Schema/migrations:  none (no DB exists yet; Prisma scaffold deferred to Phase 4 Part 3)
- Errors encountered: Stack truth contradiction — memory note Path A (vanilla locked) vs PRODUCT.md target stack (Next.js/tRPC/Prisma).
- Errors resolved:    Via AskUserQuestion: PRODUCT.md wins per Rule 28. inputs.yml declares target stack + migration.brownfield: true. Memory note marked STALE.
- Notes:              Branch: chore/adopt-spec-driven (Prompt 1.5.1 safety backup). Tag: pre-spec-driven-adoption-20260531 on main. deploy-v31.sh ran clean (framework files byte-identical from 76990c3 commit, .gitignore already had V32 entries, NEVER-TOUCH guard passed). 4 Sonnet dispatches per V32 R1/R2 (3 governance + 2 spec + 1 schema + 4 state). Total ~1120 lines.
