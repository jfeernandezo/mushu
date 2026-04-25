# Single-stage worker. Build context MUST be the monorepo root.

FROM node:24-alpine

RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production

# Run pending migrations on every worker start. drizzle-orm migrator is
# idempotent (checks __drizzle_migrations); doing it here (and not in web)
# avoids races between web replicas. Web requests that hit the DB before
# the worker has booted on a fresh deploy will fail until this completes —
# acceptable for pre-alpha.
CMD ["sh", "-c", "pnpm --filter @mushu/db migrate && pnpm --filter @mushu/worker start"]
