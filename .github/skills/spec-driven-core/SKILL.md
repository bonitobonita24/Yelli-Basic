---
name: spec-driven-core
description: Core framework rules for building TypeScript enterprise SaaS apps with Spec-Driven Platform V32.1.5. Load when starting any Phase 4-8 task, Feature Update, or governance action.
priority: supplemental  # never overrides CLAUDE.md rules
---

# Spec-Driven Platform V32.1.5 — Core Rules Compact Reference

## MANDATORY READ ORDER (do not skip, do not reorder)
0. .cline/STATE.md — FIRST. Answers "where am I right now?"
1. .cline/memory/lessons.md — ALL 🔴 gotchas first, ALL 🟤 decisions second, rest by relevance
2. docs/PRODUCT.md — what to build (read ONLY relevant sections per task scope — full file 600+ lines)
3. inputs.yml — locked tech stack + config
4. inputs.schema.json — validation schema
5. docs/CHANGELOG_AI.md — what has been done and by whom
6. docs/DECISIONS_LOG.md — never re-ask anything LOCKED here
7. docs/IMPLEMENTATION_MAP.md — current build state
8. project.memory.md — active rules and agent stack
9. .cline/memory/agent-log.md — running log of every agent action

Do not write a single line of code until all 9 are read (or summarized via Sonnet Scout per V32 R5 if scope > 200 lines per file).

## NON-NEGOTIABLE RULES
- docs/PRODUCT.md is the ONLY file a human edits. Never touch apps/, packages/, deploy/ directly.
- TypeScript strict everywhere. No `any` types. No `.js` files in src/ or apps/.
- Read STATE.md before the 9 governance docs every session (Rule 24).
- Never commit directly to main. Always branch first (Rule 23 — feat/{slug}, scaffold/part-{N}, fix/{slug}, chore/{slug}). Squash-merge only.
- Write failing test BEFORE implementation. RED → GREEN → refactor (Rule 25).
- Two-stage review before every merge: spec compliance then code quality (Rule 25).
- CREDENTIALS.md is gitignored. Never read into context. Never log in any governance doc.
- Strip `<private>` tags from PRODUCT.md before processing (Rule 20).
- Search before reading: codebase_search (SocratiCode) before opening any file (Rule 17).
- Read design-system/MASTER.md before any UI generation. Skip gracefully if absent (Rule 21).
- Governance writes are non-blocking: append after implementation, never before.
- HTTP security headers + tiered rate limiter + DOMPurify XSS sanitizer + pnpm audit are always-on defaults.

## V32 EXECUTION MODEL — ZERO OPUS EXECUTION
- Opus 4.7 = Architect ONLY. Plans, decomposes, reviews. NEVER calls Edit/Write on project files. STATE.md checkpoint is the sole Opus write exception.
- Sonnet 4.6 = Executor. ALL implementation, tests, commits, governance doc updates.
- Pre-dispatch gate: `wc -l` every file in scope. Total ≤ 500 lines per Sonnet task (R2). Files > 300 lines need explicit line ranges (R3). Files > 200 lines → Sonnet Scout first (R5).
- Failure protocol (R4): BLOCKED/thrash → re-decompose (max 3 attempts) → defer. NEVER escalate to Opus execution.
- V32.1 baseline: dispatch prompts ≤ ~1K tokens, tool-use budget ≤ 5 per dispatch, verification on Opus side via ctx_execute.

## AGENT ATTRIBUTION (include in every CHANGELOG_AI.md entry — Rule 15)
CLAUDE_CODE | COPILOT | HUMAN | UNKNOWN
(Cline deprecated V31 — not part of active attribution chain.)

## GIT BRANCH NAMING
feat/{slug} · scaffold/part-{N} · fix/{slug} · chore/{slug}
Squash-merge only. Delete branch after merge. Conventional commits only.

## ERROR RECOVERY (4 types)
TYPE 1 HARD FAILURE: attempt 1 → attempt 2 different approach (codebase_search first) → write handoff at .cline/handoffs/ → STOP.
TYPE 2 PARTIAL SUCCESS: STATE.md PHASE += " PARTIAL", list changed files in LAST_DONE, write handoff, wait for "Resume from handoff: [file]".
TYPE 3 STALE STATE: stop, run Governance Sync, do not proceed until STATE.md + governance docs match codebase.
TYPE 4 RESUME AFTER INTERRUPTION: read STATE.md first; if PARTIAL → TYPE 2 path; if missing → handoff + ask user which phase to resume. NEVER assume current phase from conversation history.

## SKILLS IN THIS PROJECT
- At task start: list .github/skills/ (directory names only — no full reads).
- For each directory found: read description: frontmatter line only.
- IF description matches current task → read full SKILL.md → follow numbered steps.
- IF no match → proceed with CLAUDE.md rules only.
- Never load all skills at once.

## CONTEXT7 (Rule 30 — MANDATORY for any library work)
Append "use context7" to any task involving external libraries.
Context7 MCP fetches current version-specific docs before code is written.
Priority libs: Next.js, Prisma, Auth.js v5, tRPC, shadcn/ui, BullMQ, Workbox, Valkey (use Redis docs — compatible).
Skipping context7 risks hallucinated deprecated APIs → Phase 5 validation failures.

## UI COMPONENT RULES (V29 + V31.3 dual-path)
- shadcn/ui is the ONLY component library. Never MUI, Ant, Chakra, etc.
- Charts: shadcn Chart (Recharts under the hood) — never raw Recharts/Chart.js/D3.
- Forms: shadcn Form + React Hook Form + Zod — reuse schemas from packages/shared.
- Icons: lucide-react ONLY.
- Loading states (Rule 11 dual-path): shadcn `<Skeleton>` for shadcn-composed UI; `@aejkatappaja/phantom-ui` wrapper for bespoke/custom UI. NEVER hand-roll a `*Skeleton.tsx` twin file.
