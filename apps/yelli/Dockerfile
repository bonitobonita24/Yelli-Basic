# syntax=docker/dockerfile:1.7
# ─── Yelli — production image (Part 5 scaffold) ──────────────────────────
# 3-stage: deps → builder → standalone runner. Next.js 16 output:'standalone'
# emits a self-contained server.js + minimal node_modules — small image.
# LOCKED Deployment Tags: prod tag scheme :vX.Y.Z (immutable) + floating :prod.

# ─── Stage 1: deps (workspace install) ───────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace metadata + per-package package.json for cacheable install.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
# Clean-slate package set (S1–S4): shared, db, ui, jobs + the web app.
# (api-client / storage are not scaffolded yet — add their COPY lines when they land.)
COPY apps/yelli/package.json apps/yelli/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/jobs/package.json packages/jobs/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder ────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=true

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/yelli/node_modules ./apps/yelli/node_modules
COPY . .

# Regenerate Prisma client inside the image (matches Linux libc).
RUN pnpm --filter @yelli/db exec prisma generate

# Build the yelli app — emits .next/standalone + .next/static.
RUN pnpm --filter @yelli/web build

# ─── Stage 3: runner (minimal) ───────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl tini
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output bundles everything needed to run.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/yelli/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/yelli/.next/static ./apps/yelli/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/yelli/public ./apps/yelli/public

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/yelli/server.js"]
