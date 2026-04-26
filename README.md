# Mushu

> Open-source ManyChat alternative — Instagram automation, self-hosted.

Read this in: [English](README.md) · [Português](README.pt-BR.md)

Mushu is your loyal little dragon for Instagram automation: keyword-triggered
DMs, comment replies, lead capture via conversation, and contact tagging — all
running on your own VPS, free forever for self-hosters. A hosted version lives
at [mushu.rayastudio.com.br](https://mushu.rayastudio.com.br).

## Status

**Pre-alpha.** Schema and APIs still change without notice. Don't bet a
production workload on it yet.

The hosted instance is currently in **Meta Development Mode** (App Review in
progress) — only Instagram users explicitly added as testers can authenticate
and connect their account. Self-hosted forks need their own Meta app.

## What is Mushu?

Mushu is an Instagram-only chatbot platform you can self-host. It does what
ManyChat does for IG — comment-to-DM automations, keyword triggers, multi-step
flows, lead capture — without the per-contact pricing or the vendor lock-in.

It exists because in March 2026 ManyChat dropped its free tier from 1,000
contacts to 25 and started charging $29/month for AI steps. We think a single
channel like Instagram should be free and self-hostable. We focus exclusively
on IG (no WhatsApp, no email, no SMS) so we can do that one channel really
well.

## Features

### Authentication & accounts

- Email/password sign-in via Better Auth 1.6.9.
- Multi-tenant organizations (workspaces) — auto-created on signup via a
  `databaseHooks.session.create.before` hook in
  [auth.ts](apps/web/src/lib/auth.ts) so users never get stuck without an
  active workspace.
- Sessions management: list active sessions, revoke individuals, revoke all
  others, "this session" badge.
- Profile and password change forms.
- Self-service account deletion (Better Auth `deleteUser`).
- Sign-out via the avatar dropdown in the top-bar AND a dedicated button in
  `/settings`.

### Internationalization

- Full pt-BR + EN coverage (~300+ keys) — every user-facing string.
- Switch language at `/settings/preferences`. Persisted on `user.locale` and
  mirrored to a cookie so server components don't round-trip the DB.
- Powered by next-intl 4.9.1, configured **without** URL prefixes (`/login`,
  not `/en/login`).

### Theme

- Light, Dark and System modes.
- Anti-FOUC inline script in `<html>` reads the cookie and applies
  `data-theme` before React mounts.
- Persisted on `user.theme` when signed in; falls back to the cookie
  otherwise.
- Recharts and ReactFlow read their palettes from a shared
  `theme-colors.ts` so charts and the canvas re-skin on theme switch.

### Notifications

- DB-backed `notification` table — events stick around even if the worker
  restarts.
- Bell icon in the top-bar with an unread-count badge, dropdown showing the
  most recent N, and 30-second polling.
- Full `/notifications` page with mark-all-as-read.
- Generated at meaningful moments — e.g. when an Instagram account is
  connected. Future events (worker errors, expiring tokens) plug into the
  same surface.

### Legal pages

- `/privacy`, `/terms`, and `/data-deletion` read company identity from env
  vars (`LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_CNPJ`, `LEGAL_CONTACT_EMAIL`,
  etc).
- A self-hosted fork uses **its own** legal entity — never ship with the
  upstream's CNPJ. See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for the
  required env vars.
- LGPD-aligned wording for the Brazilian market.

### Flow builder (visual)

- Drag-and-drop canvas built on [@xyflow/react](https://reactflow.dev/).
- Plain-language palette ("When someone comments on your post", "Send a
  private message") instead of engineering jargon.
- Contextual right-side inspector. Empty canvas shows a CTA pointing at the
  palette.
- **Flow templates** with a picker dialog at creation time: Comment→DM, Lead
  capture via DM, Welcome DM. Each template ships with sensible defaults the
  user only needs to tweak.
- **Template banner** on flows started from a template — explains how to
  edit, add and remove steps. Dismissible per-flow via localStorage.
- **Friendly pre-publish validation** with toasts ("Add at least one
  trigger…", "There's an action with an empty message…") — no Zod stack
  traces leak to the user.
- Flow list: cards with an Active/Draft badge and a 3-dot menu for
  Enable/Disable/Delete (delete shows an AlertDialog confirmation).

### Triggers (entry points)

- `trigger.comment_keyword` — fires on a comment matching one or more
  keywords. Includes a **post selector** that fetches the connected
  account's recent media via the Graph API and shows thumbnail + caption +
  timestamp, plus an "any post on the account" wildcard option.
- `trigger.dm_keyword` — fires on an inbound DM matching keywords.
- **Keyword chip input** — each keyword is a removable chip; comma or Enter
  commits, Backspace removes the last one.
- **Case + accent insensitive** matching by default — typing `informação`
  also matches `informacao`, `INFORMACAO`, `Informação`. Implemented via NFD
  normalization in [trigger-matcher.ts](apps/worker/src/lib/trigger-matcher.ts).
- Live "Also matches: …" preview under the chips.

### Actions

- `action.send_dm` — sends a DM. Message text supports `{{variable}}`
  substitution before send.
- `action.reply_comment` — replies to the originating comment publicly.
- `action.ask_question` — sends a prompt, pauses the flow, validates the
  user's reply (`text` / `email` / `number` / `phone`), and stores it in a
  variable. Sends a fallback prompt on invalid input with a configurable
  retry limit.
- `action.set_tag` — adds or removes a tag on the contact.
- `action.set_custom_field` — writes into `contact.customFields` (jsonb).

### Logic

- `logic.delay` — pauses the run for N seconds (up to 30 days).
- `logic.condition` — multi-branch conditional with 10 operators (`equals`,
  `not_equals`, `contains`, `starts_with`, `gt`, `lt`, `is_set`, `is_empty`,
  `has_tag`, `not_has_tag`) and AND/OR grouping. Each branch is evaluated in
  order; the last one is the implicit "else".

### Control

- `control.end` — terminates the run cleanly.

### Variables & state

- `{{variable_name}}` placeholders in any message body are substituted right
  before send.
- Lookup order: `state.variables` (in-flight per-execution) →
  `contact.customFields` (persistent per-contact) → empty string.
- Persistence per contact means a variable captured in one flow is visible to
  any later flow targeting the same person — ManyChat-style "subscriber
  attributes".

### Worker engine

- Postgres-backed state machine in `flow_execution`.
- Statuses: `active` / `waiting` (delay) / `awaiting_input` (ask_question) /
  `done` / `failed` / `cancelled`.
- **Pause/resume**: `ask_question` parks the run as `awaiting_input`. The
  next inbound DM from the same contact is interpreted as the answer by
  [`tryResumeAwaitingFlow`](apps/worker/src/processors/process-event.ts) —
  no separate webhook plumbing.
- Cycle detection (`visitedNodes` set) refuses to re-enter a node within the
  same execution.
- Per-execution concurrency lock (`isReplying`) prevents two webhook events
  from racing the same run.
- Each execution carries its own `graphSnapshot` — re-publishing a flow
  doesn't break runs that are already in flight.

## Stack

| Layer       | Tech                                                  |
| ----------- | ----------------------------------------------------- |
| Framework   | Next.js 15 (App Router, Server Actions, Turbopack)    |
| Language    | TypeScript (strict)                                   |
| ORM / DB    | Drizzle ORM + Postgres 16                             |
| Queue       | BullMQ + Redis                                        |
| Auth        | Better Auth 1.6.9 (organizations plugin)              |
| i18n        | next-intl 4.9.1                                       |
| Toasts      | Sonner 2.0.7                                          |
| Flow UI     | @xyflow/react 12.10                                   |
| Styling     | Tailwind v4 (CSS vars + `@theme`)                     |
| UI prims    | Radix (Dialog, AlertDialog, DropdownMenu, Avatar)     |
| Icons       | lucide-react                                          |
| Validation  | Zod 4                                                 |
| Lint/Format | Biome                                                 |
| Storage     | MinIO (S3-compatible)                                 |

## Architecture

```text
Meta Webhook ──▶ /api/webhooks/instagram ──▶ Postgres (incoming_event)
                                              │
                                              ▼
                                          BullMQ (Redis)
                                              │
                                              ▼
                                    ┌── process-event ──┐
                                    │  awaiting_input?  │
                                    │       ↓ yes       │
                                    │  resume run       │
                                    │       ↓ no        │
                                    │  match triggers   │
                                    │  start new run    │
                                    └─────────┬─────────┘
                                              ▼
                                    ┌── execute-flow ───┐
                                    │ state machine:    │
                                    │  active → waiting │
                                    │       → awaiting  │
                                    │       → done      │
                                    │ render {{var}}    │
                                    │ eval conditions   │
                                    └─────────┬─────────┘
                                              ▼
                                    ┌── send-message ───┐
                                    │ IG Graph API call │
                                    │ rate limit guard  │
                                    └───────────────────┘
```

## Project structure

```text
mushu/
├─ apps/
│  ├─ web/          # Next.js app (UI + API routes + server actions)
│  └─ worker/       # BullMQ worker (event processing + flow execution)
├─ packages/
│  ├─ db/           # Drizzle schemas + migrations + db client
│  └─ shared/       # Flow node Zod schemas, template renderer, crypto
├─ docs/            # SELF_HOSTING.md, PRD, architecture notes
└─ docker-compose.yml
```

## Quick start (local dev)

```bash
# 1. Clone
git clone https://github.com/jfeernandezo/mushu.git
cd mushu

# 2. Install
pnpm install

# 3. Set up env
cp .env.example .env
# edit .env — at minimum: META_APP_ID, META_APP_SECRET,
# INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, ngrok URL for the webhook

# 4. Start infra (postgres, redis, minio)
docker compose up -d postgres redis minio

# 5. Run migrations
pnpm db:migrate

# 6. Start dev (web + worker)
pnpm dev
```

Web at <http://localhost:3000>; worker logs in the same terminal.

> Note on credentials: `META_APP_ID` / `META_APP_SECRET` are the Facebook App
> values (used for webhook signature verification). `INSTAGRAM_APP_ID` /
> `INSTAGRAM_APP_SECRET` come from the Instagram product setup ("API setup
> with Instagram login") — they are **different** numbers.

## Self-hosting

Read [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) **before exposing your
instance to users**. The legal pages read company identity from env vars at
runtime — never ship with the upstream's CNPJ or with the placeholder values.
Each fork needs its own Meta app, encryption keys (`TOKEN_ENCRYPTION_KEY`),
and Better Auth secret (`BETTER_AUTH_SECRET`).

## Roadmap

- ~~**Phase 1** — Variables, ask_question, real condition evaluator~~ — shipped
- **Phase 2** — Quick replies (reply buttons inside DMs), Welcome DM trigger
  (`trigger.first_dm`), set_tag wiring in the inspector, additional
  templates (welcome-on-first-DM, comment-first-time)
- **Phase 3** — Wait for reply (`logic.wait_reply` with timeout + follow-up),
  Story mention/reply triggers, Inbox view (conversation list with human
  takeover)
- **Phase 4** — Gallery / carousel block, Webhook-out HTTP block, AI block
  (Anthropic Claude), additional input types on ask_question, Broadcast
  (with Meta 24-hour window compliance), per-step analytics, undo/redo on
  the canvas
- **Phase 5** — Extensive template gallery (10–15 templates organized by
  category)

Anything not listed here may still happen — the roadmap evolves with what we
learn from real usage.

## License

[AGPL-3.0-only](LICENSE). Commercial license available — contact
<adm@rayastudio.com.br>.

## Built by

[Raya Studio](https://rayastudio.com.br).
