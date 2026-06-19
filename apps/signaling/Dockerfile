# syntax=docker/dockerfile:1.7
# ─── Yelli signaling — WebSocket signaling server (W2b) ───────────────────
# 3-stage: deps → builder (esbuild bundle) → minimal runner.
# The build bundles everything (ws, ioredis, @auth/core, jose, zod, @yelli/shared)
# into a single self-contained dist/server.cjs, so the runner needs ZERO
# node_modules — only the bundle + Node. Topology: own container, Traefik
# PathPrefix(`/ws`) reverse-proxied (q-W2b-01). LOCKED tags: :vX.Y.Z + floating :prod.

# ─── Stage 1: deps (workspace install) ───────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace metadata + every package.json (frozen install resolves the whole graph).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/signaling/package.json apps/signaling/package.json
COPY apps/yelli/package.json apps/yelli/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/jobs/package.json packages/jobs/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder (esbuild bundle) ────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV SKIP_ENV_VALIDATION=1

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/signaling/node_modules ./apps/signaling/node_modules
COPY . .

# Emits a single self-contained apps/signaling/dist/server.cjs.
RUN pnpm --filter @yelli/signaling build

# ─── Stage 3: runner (minimal — just the bundle) ──────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache tini tzdata
ENV NODE_ENV=production
ENV SIGNALING_PORT=3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 yelli

COPY --from=builder --chown=yelli:nodejs /repo/apps/signaling/dist/server.cjs ./server.cjs

USER yelli
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.cjs"]
