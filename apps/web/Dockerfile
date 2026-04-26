# Single-stage build for portability across Easypanel / vanilla Docker.
# We accept a slightly larger image in exchange for not relying on BuildKit
# cache mounts or pnpm-symlink-aware multi-stage COPYs.
# Build context MUST be the monorepo root.
#
# ── Build-time vs runtime variables ─────────────────────────────────────────
# Only THREE variables need to be available at build time. Everything else
# (DATABASE_URL, STRIPE_*, SMTP_*, META/INSTAGRAM_*, TOKEN_ENCRYPTION_KEY,
# REDIS_URL, LEGAL_*, etc.) is read at runtime and MUST NOT appear here.
#
# Build-time (declared as ARG below):
#   - NEXT_PUBLIC_APP_URL  — inlined into the client bundle by Next.js
#   - BETTER_AUTH_URL      — read during prerender (avoids baked default)
#   - BETTER_AUTH_SECRET   — read during prerender (avoids baked default)
#
# ── Easypanel limitation (relevant for ops) ────────────────────────────────
# Easypanel passes EVERY env var as `--build-arg` to docker build, regardless
# of which ARGs this Dockerfile declares. Vars not declared here are silently
# ignored by the build itself BUT appear in plaintext in the build log of the
# Easypanel panel. Treat the build log as sensitive: rotate all credentials
# before switching to Stripe live mode. See docs/SECURITY.md for the full
# pre-live checklist.

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
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# they MUST be declared as ARGs and exported as ENV before `next build` runs.
# BETTER_AUTH_{URL,SECRET} are read during prerender too; declaring them
# avoids a noisy warning and a baked-in default secret in static output.
ARG NEXT_PUBLIC_APP_URL
ARG BETTER_AUTH_URL
ARG BETTER_AUTH_SECRET
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    BETTER_AUTH_URL=${BETTER_AUTH_URL} \
    BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET} \
    NEXT_TELEMETRY_DISABLED=1
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
