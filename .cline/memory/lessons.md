# Lessons Memory — Yelli Spec-Driven Platform V31
# Entry format: ## YYYY-MM-DD — [ICON] [Title]
# Types: 🔴 gotcha | 🟡 fix | 🟤 decision | ⚖️ trade-off | 🟢 change
# READ ORDER: 🔴 first → 🟤 second → rest by relevance
# ---

## 2026-06-01 — 🟤 Yelli brownfield: PRODUCT.md target stack wins over Path A memory
- Type:      🟤 decision
- Phase:     Prompt 1.5.4 brownfield Adoption-mode Bootstrap
- Files:     docs/PRODUCT.md, inputs.yml, docs/DECISIONS_LOG.md, ~/.claude/projects/.../memory/MEMORY.md
- Concepts:  brownfield, stack-truth, Rule 28 priority, migration
- Narrative: Memory note `project_yelli_brownfield_migration.md` (2026-05-30) declared
  Yelli-Basic permanently locked on vanilla Node + ws stack (Path A). PRODUCT.md
  finalized 2026-05-31 (Step 9 lock) declares target stack as Next.js + tRPC + Prisma
  + Auth.js v5 + PostgreSQL + Valkey + MinIO with `migration.brownfield: true` and
  explicit instruction "Phase 4 Part 1 must rewrite the signaling layer rather than
  retrofit the framework around the existing code." Per Rule 28 (Global Priority
  Order), PRODUCT.md (priority 4) outranks memory/user-context (priority 8). User
  confirmed via AskUserQuestion 2026-06-01: PRODUCT.md wins. Existing vanilla
  server.js + public/index.html retained as visual + behavioural reference for
  Phase 4 Part 1 rewrite, not as the destination stack.

## 2026-06-01 — 🟤 Zero Opus Execution operating mode (V32 R1)
- Type:      🟤 decision
- Phase:     1.5.4 governance scaffold
- Files:     .claude/rules/memory-governance.md
- Concepts:  V32, Architect-Execute, Opus, Sonnet, dispatch model
- Narrative: All file writes during 1.5.4 dispatched to Sonnet via Agent(model: "sonnet")
  per V32 R1. Opus drafted exact content; Sonnet wrote mechanically (3 dispatches:
  governance docs / spec files / runtime state). Only Opus write was .cline/STATE.md
  (the R1 exception). This pattern continues for all subsequent phases.
