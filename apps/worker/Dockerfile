# syntax=docker/dockerfile:1.7
# Build context MUST be the monorepo root.
# Easypanel: set Build Path = "/" and Dockerfile Path = "apps/worker/Dockerfile".

FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /repo

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 mushu

# Bring deps in first (cache layer)
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules

# Then source — only the bits the worker actually needs.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/worker apps/worker
COPY packages/db packages/db
COPY packages/shared packages/shared

RUN chown -R mushu:nodejs /repo
USER mushu

# Worker doesn't expose a port — it consumes BullMQ from Redis.
# tsx is in apps/worker/node_modules/.bin (linked by pnpm)
CMD ["pnpm", "--filter", "@mushu/worker", "start"]
