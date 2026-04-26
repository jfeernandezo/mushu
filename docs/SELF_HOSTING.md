# Self-hosting Mushu

This guide is for operators running their **own** instance of Mushu — whether
on a VPS, Easypanel, Kubernetes, or just locally for development. If you only
want to use the hosted version at <https://mushu.rayastudio.com.br>, you don't
need any of this.

> **Important:** Mushu is open-source under AGPL-3.0. Anyone can fork it and
> run their own instance. But the legal/branding identity that ships in this
> repo (logo, company data on the legal pages, hosted SaaS URL) belongs to the
> upstream project. **Configure your own** before exposing your instance to
> users.

## What you must replace before going to production

### 1. Company identity (legal pages)

`/privacy`, `/terms`, and `/data-deletion` render the operator's legal entity
verbatim — CNPJ, address, contact email, foro. The text framework lives in
source, but the entity is read from environment variables at request time.

Set these in your deployment environment (Easypanel app vars, Docker env file,
`.env` for local dev, etc.):

| Variable                   | Example                                                | Purpose                                      |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `LEGAL_COMPANY_NAME`       | `Sua Empresa LTDA`                                     | Razão social — controlador LGPD              |
| `LEGAL_COMPANY_TRADE_NAME` | `Sua Marca`                                            | Nome de fantasia                             |
| `LEGAL_COMPANY_CNPJ`       | `00.000.000/0001-00`                                   | CNPJ do controlador                          |
| `LEGAL_COMPANY_ADDRESS`    | `Rua Exemplo, 123, Bairro, Cidade/UF, CEP 00000-000`   | Endereço da sede                             |
| `LEGAL_CONTACT_EMAIL`      | `dpo@seudominio.com`                                   | Encarregado / contato LGPD e Meta            |
| `LEGAL_JURISDICTION`       | `Comarca de São Paulo, SP, Brasil`                     | Foro de eleição (cláusula 14 dos Termos)     |
| `LEGAL_EFFECTIVE_DATE`     | `25 de abril de 2026`                                  | Data de vigência exibida nas páginas         |
| `NEXT_PUBLIC_APP_URL`      | `https://mushu.seudominio.com`                         | Domínio canônico do seu deploy               |

If a variable is missing, the page renders `[Configure no .env]` in its place
— a deliberate eyesore so you can't forget. Do **not** ship to production with
those placeholders visible to users; you'd be misrepresenting the controller.

The page text itself is generic (it talks about "Mushu", scopes, retention,
etc.) and doesn't need editing for standard self-hosting. If your business
model differs significantly from the upstream project's (e.g. you charge,
you're outside Brazil, you process additional categories of data), have a
lawyer review the text in
[`apps/web/src/app/(legal)/`](../apps/web/src/app/(legal)/) before going live.

### 2. Branding (logo, favicon, name)

The Mushu name and dragon logo belong to Raya Studio. If you fork and rebrand:

- Replace [`apps/web/src/app/icon.png`](../apps/web/src/app/icon.png) with
  your own square PNG (used as favicon — Next.js auto-generates the `<link>`
  tags from the file name).
- Replace [`apps/web/public/mushu-logo.png`](../apps/web/public/mushu-logo.png)
  with your own logo (referenced by `<Image>` on the landing, login, signup,
  sidebar, and the legal layout header).
- Search for the literal string `Mushu` and replace where appropriate
  (sidebar, page titles, `apps/web/src/lib/legal.ts`).

If you keep the Mushu name and logo, your service is still distinguishable
because the legal pages identify your CNPJ as the operator — but the
trademark/branding is upstream's. The AGPL doesn't grant trademark rights.

### 3. Meta app (Instagram OAuth)

Each fork needs its **own** Meta app — you cannot share the upstream's app id
because the redirect URI must point to your domain.

- Create a new app at <https://developers.facebook.com/apps/>
- Add the **Instagram** product with use case "Acessar e gerenciar mensagens
  e dados do Instagram"
- In **Configurações do app → Básico**, fill in:
  - **Privacy Policy URL**: `https://your-domain.com/privacy`
  - **Terms of Service URL**: `https://your-domain.com/terms`
  - **Data Deletion Instructions URL**: `https://your-domain.com/data-deletion`
- In **Instagram → API setup with Instagram business login → Configuration**,
  add `https://your-domain.com/api/oauth/instagram/callback` to **Valid OAuth
  Redirect URIs**.
- Set the env vars on your deploy:

| Variable                       | Source |
| ------------------------------ | ------ |
| `META_APP_ID`                  | Facebook App ID (top of dashboard) — used for webhook signature verification |
| `META_APP_SECRET`              | Facebook App Secret (rotate if exposed) |
| `INSTAGRAM_APP_ID`             | Instagram App ID — Dashboard → Instagram → "API setup with Instagram login". **Different** from `META_APP_ID`. |
| `INSTAGRAM_APP_SECRET`         | Instagram App Secret from the same screen |
| `META_WEBHOOK_VERIFY_TOKEN`    | Random string you choose |
| `INSTAGRAM_OAUTH_REDIRECT_URI` | `https://.../api/oauth/instagram/callback` |

While the app is in **Development mode**, only Facebook users you add as
Tester / Developer / Admin can log in. Submit the app for review when you're
ready to onboard external users.

### 4. Encryption key (Instagram tokens at rest)

`TOKEN_ENCRYPTION_KEY` must be unique per deployment — anyone with this key
can decrypt every IG access token in your database.

Generate with:

```bash
openssl rand -hex 32
```

Never commit it. Never reuse the upstream's. Rotate if leaked (you'll need to
re-encrypt existing tokens; PR welcome on the rotation tooling).

### 5. Better Auth secret

Same story: `BETTER_AUTH_SECRET` must be unique per deployment. Generate with
`openssl rand -base64 32`. If this leaks, sessions can be forged.

### 6. Postgres role separation (Row Level Security)

Migration `0002_rls_tenant_isolation.sql` enables Row Level Security on every
tenant table (`contact`, `conversation`, `flow`, `flow_execution`,
`instagram_account`, `message`, `notification`, `trigger`, `contact_inbox`,
`contact_tag`). The app sets `app.current_org_id` per transaction via
`withOrgTx(orgId, fn)` and Postgres refuses to return rows from any other
workspace.

Policies only matter if the connecting role does **not** have `BYPASSRLS`. Two
roles, two `DATABASE_URL`s:

```sql
-- Run as the database owner (the role that ran the migrations).

CREATE ROLE mushu_app LOGIN PASSWORD 'change-me-strong';
GRANT CONNECT ON DATABASE mushu TO mushu_app;
GRANT USAGE ON SCHEMA public TO mushu_app;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO mushu_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mushu_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mushu_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mushu_app;
-- Note: NO BYPASSRLS — this role is constrained by the policies.

CREATE ROLE mushu_admin LOGIN PASSWORD 'change-me-strong' BYPASSRLS;
GRANT CONNECT ON DATABASE mushu TO mushu_admin;
GRANT USAGE ON SCHEMA public TO mushu_admin;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO mushu_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mushu_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mushu_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mushu_admin;
```

Then set:

| Variable             | Used by                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`       | `postgres://mushu_app:...@host/mushu` — web app (RLS active)                     |
| `ADMIN_DATABASE_URL` | `postgres://mushu_admin:...@host/mushu` — worker, webhook ingest, OAuth callback |

If `ADMIN_DATABASE_URL` is unset, the app falls back to `DATABASE_URL`. That
works for local dev where the same superuser bypasses RLS implicitly, but in
production you want both URLs set so the web app's user-facing requests
*cannot* read across workspaces, even if app code has a bug.

Verify the split works:

```sql
-- As mushu_app:
SELECT count(*) FROM contact;                       -- expect 0 (no GUC set)
SELECT set_config('app.current_org_id', '<an-org-id>', false);
SELECT count(*) FROM contact;                       -- expect that org's rows
```

### 7. HTTPS, headers, reverse proxy (VPS deploys)

Mushu emits security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy) from `apps/web/next.config.ts`. They go
out as soon as the response leaves Next.js. **HTTPS itself you provide via
the reverse proxy** in front (nginx, Caddy, Traefik). Caddy auto-handles
Let's Encrypt; nginx needs Certbot.

The app reads the client IP from `X-Forwarded-For`. Configure your proxy to
set it to the original client (not its own loopback IP):

```caddy
# Caddyfile
mushu.example.com {
  reverse_proxy localhost:3000 {
    header_up X-Forwarded-For {remote_host}
    header_up X-Real-IP {remote_host}
  }
}
```

```nginx
# nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

Without this, the auth rate limiter and audit log all see the proxy's IP and
the per-IP limit becomes a global limit.

### 8. `MUSHU_MODE`: hosted vs. self-host

`MUSHU_MODE` is the master switch that turns the billing/Stripe layer on. It
has exactly two values:

- **`selfhost`** (default — set when the env var is missing or anything other
  than the literal string `'hosted'`):
  - `/pricing`, `/settings/billing`, `/api/billing/*`, `/api/webhooks/stripe`
    return 404
  - The landing hero shows "Sign in" + "View on GitHub" (no upgrade CTAs)
  - Every `feature.*` permission is automatically granted (AI step,
    white-label, etc.) — your fork is unrestricted
  - Stripe is never imported, no Stripe env vars required
  - **This is what every fork should use.** Don't set anything.

- **`hosted`**:
  - Billing routes are reachable
  - Landing shows "Start free" / "See pricing" / "Self-host" trio
  - `feature.*` permissions are gated by the org's plan subscription
  - On startup, [`apps/web/instrumentation.ts`](../apps/web/instrumentation.ts)
    refuses to boot if any of the four `STRIPE_*` env vars below are missing.
    The error message names which one — fix and restart.

Switching modes requires a rebuild + restart (env vars are read at boot).

### 9. Stripe (only for `MUSHU_MODE=hosted`)

If you're hosting Mushu commercially with paid plans, configure Stripe:

```bash
STRIPE_SECRET_KEY=sk_live_...        # https://dashboard.stripe.com/apikeys
STRIPE_WEBHOOK_SECRET=whsec_...      # set after creating the endpoint below
STRIPE_PRICE_ID_PRO=price_...        # one recurring Price per Product
STRIPE_PRICE_ID_AGENCY=price_...
```

**One-time setup in the Stripe Dashboard:**

1. **Products** → New product → "Mushu Pro" → recurring Price R$ 97/month BRL.
   Copy the price ID into `STRIPE_PRICE_ID_PRO`.
2. **Products** → New product → "Mushu Agency" → recurring Price R$ 197/month BRL.
   Copy the price ID into `STRIPE_PRICE_ID_AGENCY`.
3. **Developers → Webhooks** → Add endpoint pointing to
   `https://your-domain.com/api/webhooks/stripe`. Subscribe to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   Reveal the Signing secret and copy it into `STRIPE_WEBHOOK_SECRET`.
4. **Settings → Customer portal** → enable. The portal URL is created on
   demand by `/api/billing/portal` for each customer.

The `plan` table's `stripe_price_id` column is read at runtime by
`/api/billing/checkout` to pass the right price to Stripe Checkout — keep
the IDs there in sync with the env vars (they should match by convention).

The Free plan has no Stripe price and no checkout flow; new signups land on
Free automatically.

### 10. Permissions architecture

Roles are *identity*, not access rules. Every action goes through a
permission group:

- **4 roles** (workspace identity labels): `owner`, `admin`, `editor`,
  `viewer`. Set on the `member.role` column.
- **Workspace permission groups** (seeded by migration 0003): one per role,
  containing the default permissions for that role. Mapped via
  `role_permission_group`.
- **Plan permission groups** (seeded by migration 0004): unlock `feature.*`
  permissions when the org's subscription is `active` or `trialing`. Mapped
  via `plan_permission_group`.
- **Direct group memberships** (`member_permission_group`): for one-off
  overrides — you can grant a member extra groups beyond what their role
  gives. Wiped and re-applied when their role changes.

The resolver lives in
[`apps/web/src/lib/permissions.ts`](../apps/web/src/lib/permissions.ts).
Server Actions guard themselves with `requirePermission(memberId, code)`
before performing any side-effect.

To add a new permission:

1. Insert into `permission` (workspace or feature scope).
2. Add it to the relevant group(s) via `permission_group_permission`.
3. Reference the code in the Server Action / route / UI gating.

To add a new role: insert mappings into `role_permission_group` for each
group that role should grant. Update the UI dropdown in
[`apps/web/src/actions/members.ts`](../apps/web/src/actions/members.ts)
(`ASSIGNABLE_ROLES`).

## Going live checklist

Before pointing real users at your instance:

- [ ] All `LEGAL_*` env vars set with **your** company data, not placeholders.
- [ ] `/privacy`, `/terms`, `/data-deletion` render correctly with your data.
- [ ] Logo and favicon replaced (or you're knowingly using upstream's branding).
- [ ] Your Meta app's Privacy / Terms / Data Deletion URLs point to your domain.
- [ ] Encryption keys (`TOKEN_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`) are unique
      and not the example values.
- [ ] Database backups are configured and tested.
- [ ] HTTPS is enforced (no plain HTTP) — required by Meta for OAuth.
- [ ] Reverse proxy passes `X-Forwarded-For` correctly (rate limiter and audit
      log depend on the real client IP).
- [ ] Postgres roles split: `DATABASE_URL` points to a non-`BYPASSRLS` role,
      `ADMIN_DATABASE_URL` points to a `BYPASSRLS` role for worker / webhook.
- [ ] RLS smoke test passes (see section 6: querying `contact` as `mushu_app`
      with no GUC set returns zero rows).
- [ ] `.env` has `REDIS_URL` reachable from the web container — auth rate
      limiting fails open (allows requests) if Redis is unreachable, but you
      will see errors in logs.
- [ ] `TERMS_VERSION` and `PRIVACY_VERSION` in
      [`apps/web/src/lib/legal.ts`](../apps/web/src/lib/legal.ts) bumped if
      you've materially changed `/terms` or `/privacy` text.
- [ ] Meta app submitted for App Review (otherwise only Testers can connect IG).
- [ ] LGPD baseline reviewed by a lawyer (or at minimum, you've read the
      generated `/privacy` end to end and confirmed it matches what your
      instance actually does).
- [ ] If hosting commercially: `MUSHU_MODE=hosted` set, all 4 `STRIPE_*` vars
      filled, products + recurring prices created in Stripe, webhook endpoint
      configured with the 4 subscription events, Customer Portal enabled.
- [ ] If self-hosting: `MUSHU_MODE` left unset (defaults to `selfhost`) so
      billing routes return 404 and every feature is unlocked.

## Questions

Open an issue at <https://github.com/jfeernandezo/mushu/issues> or contact
upstream at <adm@rayastudio.com.br> for licensing/commercial inquiries.
