# Single-stage build for portability across Easypanel / vanilla Docker.
# We accept a slightly larger image in exchange for not relying on BuildKit
# cache mounts or pnpm-symlink-aware multi-stage COPYs.
# Build context MUST be the monorepo root.

FROM node:24-alpine

RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Copy the whole monorepo at once. .dockerignore strips node_modules, .next, etc.
COPY . .

# Install all workspaces (pnpm hoists shared deps).
RUN pnpm install --frozen-lockfile

# Build only the web app.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @mushu/web build

# Standalone output sits at apps/web/.next/standalone/apps/web/ because
# outputFileTracingRoot points to the monorepo root. Move static + public
# into the standalone tree so the bundled server.js can serve them. The
# public/ dir may not exist yet (we have no static assets in MVP) — guard.
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/ \
 && if [ -d apps/web/public ]; then cp -r apps/web/public apps/web/.next/standalone/apps/web/; fi

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

EXPOSE 3000

CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
