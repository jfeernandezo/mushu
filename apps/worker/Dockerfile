# Single-stage worker. Build context MUST be the monorepo root.

FROM node:24-alpine

RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production

# tsx is in apps/worker/node_modules/.bin via pnpm.
CMD ["pnpm", "--filter", "@mushu/worker", "start"]
