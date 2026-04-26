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
- [ ] Meta app submitted for App Review (otherwise only Testers can connect IG).
- [ ] LGPD baseline reviewed by a lawyer (or at minimum, you've read the
      generated `/privacy` end to end and confirmed it matches what your
      instance actually does).

## Questions

Open an issue at <https://github.com/jfeernandezo/mushu/issues> or contact
upstream at <adm@rayastudio.com.br> for licensing/commercial inquiries.
