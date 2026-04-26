# Mushu

> Open-source ManyChat alternative — Instagram automation, self-hosted.

Mushu is your loyal little dragon that handles Instagram comment replies, DM
sequences, and lead routing while you focus on the work that matters. Built to
run on your own VPS, free forever for self-hosters, with a hosted SaaS at
[mushu.rayastudio.com.br](https://mushu.rayastudio.com.br).

## Status

**Pre-alpha.** Not ready for production. APIs and schema will change.

## Features (MVP — in progress)

- Comment → DM automation (keyword match per post)
- DM sequences with delays, conditions, and branches
- Visual flow builder (React Flow / @xyflow)
- Multi-tenant ready (one instance, many workspaces)
- Self-hosted via `docker-compose`

## Stack

| Layer       | Tech                                                  |
| ----------- | ----------------------------------------------------- |
| Framework   | Next.js 15 (App Router, Server Actions, Turbopack)    |
| Language    | TypeScript (strict)                                   |
| ORM / DB    | Drizzle ORM + Postgres 16                             |
| Queue       | BullMQ + Redis                                        |
| Auth        | Better Auth (organizations + passkey)                 |
| Flow UI     | @xyflow/react                                         |
| Styling     | Tailwind v4 + shadcn/ui                               |
| Validation  | Zod                                                   |
| Lint/Format | Biome                                                 |
| Storage     | MinIO (S3-compatible)                                 |

## Quick start (local dev)

```bash
# 1. Clone
git clone https://github.com/jfeernandezo/mushu.git
cd mushu

# 2. Install
pnpm install

# 3. Set up env
cp .env.example .env
# edit .env — at minimum: META_APP_ID, META_APP_SECRET, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, ngrok URL for webhook

# 4. Start infra (postgres, redis, minio)
docker compose up -d postgres redis minio

# 5. Run migrations
pnpm db:migrate

# 6. Start dev (web + worker)
pnpm dev
```

Web at <http://localhost:3000>, worker logs in the same terminal.

## Architecture

```text
Meta Webhook ──▶ /api/webhooks/instagram ──▶ Postgres (incoming_events)
                                              │
                                              ▼
                                          BullMQ (Redis)
                                              │
                                              ▼
                                          Worker process
                                          ├─ trigger matcher
                                          ├─ flow executor
                                          ├─ IG Graph API client
                                          └─ rate limit / 24h window guard
```

See [`docs/architecture.md`](docs/architecture.md) (TODO).

## Self-hosting

Running your own instance? Read [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md)
**before exposing it to users**. In particular: the legal pages
(`/privacy`, `/terms`, `/data-deletion`) read company identity from env vars
at runtime — never ship with the upstream's CNPJ or with the placeholder
values. Each fork also needs its own Meta app, encryption keys, and Better
Auth secret.

## License

[AGPL-3.0-only](LICENSE). Commercial license available — contact
<adm@rayastudio.com.br>.

## Project goals

Mushu exists because ManyChat dropped its free tier from 1000 → 25 contacts in
March 2026 and started charging $29/month for AI steps. We think Instagram
automation should be free and self-hostable. We focus exclusively on Instagram —
no WhatsApp, no email, no SMS — to do one channel really well.

Built by [Raya Studio](https://rayastudio.com.br).
