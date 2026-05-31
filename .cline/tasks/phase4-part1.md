# Phase 4 Part 1 — Root config files (Yelli)
# Fresh Claude Code session. Read STATE.md first, then inputs.yml + PRODUCT.md only.
# Branch: scaffold/part-1. Never commit to main directly.

TASK: Generate all root config files (Part 1 of 8).

PRE-FLIGHT:
- Read .cline/STATE.md (orientation — must show PHASE="Phase 2 Op complete" or "Phase 0 Bootstrap retrofit complete")
- Read inputs.yml (app + tech_stack + ports.dev + git sections only)
- Read docs/PRODUCT.md (Section "App Identity" + "Tech Stack" only — do NOT read full file, ~621 lines)
- Read .cline/memory/lessons.md (ALL 🔴 gotchas first, ALL 🟤 decisions second)
- Create scaffold/part-1 branch

GENERATE:
- pnpm-workspace.yaml (apps/* + packages/*)
- turbo.json (pipelines: lint, typecheck, test, build with dependsOn)
- tsconfig.base.json (strict: true + noUncheckedIndexedAccess + exactOptionalPropertyTypes + noImplicitReturns + noFallthroughCasesInSwitch + esModuleInterop)
- root package.json (name=yelli, pnpm@10, root scripts delegating to turbo)
- .editorconfig
- .prettierrc (singleQuote, semi, tabWidth: 2)
- .eslintrc.js (TypeScript strict — @typescript-eslint/no-explicit-any: error)
- .gitignore (final — verify existing entries from Bootstrap Step 8 + 16 are present; idempotent)
- .nvmrc (24)

EXECUTE:
- pnpm install --frozen-lockfile
- pnpm lint + pnpm typecheck (for Part 1 files only)
- Fix all errors before merging

VERIFICATION (MANDATORY before reporting complete):
- Run: find . -maxdepth 2 -name "pnpm-workspace.yaml" -o -name "turbo.json" -o -name "tsconfig.base.json" -o -name ".nvmrc" | sort
- Confirm all expected files appear in output. If any missing → regenerate → re-verify.

GOVERNANCE SELF-CHECK:
- STATE.md rewritten with PHASE="Phase 4 Part 1 complete", LAST_DONE=root config files, NEXT="Start Part 2 in new session"
- CHANGELOG_AI.md entry written for this Part (Agent: CLAUDE_CODE)

COMMIT + MERGE:
- Commit message: "scaffold(root): root config files — Part 1 of 8"
- Squash-merge scaffold/part-1 to main. Delete branch.

OUTPUT:
"✅ Part 1 complete. Open phase4-part2.md in a NEW Claude Code session."

STOP HERE. Do not proceed to Part 2 in this session.
