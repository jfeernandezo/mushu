# Codex prompt — Mushu landing page redesign

> Self-contained prompt for Codex (GPT-5.5 + Image 2). Copy-paste sections as
> needed. Last validated against repo state on 2026-04-26.

---

## 1. Project context (read first)

You are working on **Mushu**, an open-source self-hostable Instagram automation
SaaS — the "ManyChat alternative" niche. Hosted at
`https://mushu.rayastudio.com.br`, source at `github.com/jfeernandezo/mushu`.
Status: **pre-alpha**, Meta App Review in progress.

**Stack** (do not change):

- Next.js 15 App Router (server components + server actions)
- TypeScript strict
- Tailwind v4 with `@theme` + CSS custom properties (no Tailwind config file)
- next-intl 4.9.1 (i18n, no URL prefix)
- Theme: light + dark via `[data-theme]` on `<html>`, runtime-switchable
- Better Auth (organizations plugin)
- pnpm + Turborepo monorepo

**Already installed UI primitives** (do not add new ones):

- `lucide-react` (icons)
- Radix: `react-dialog`, `react-alert-dialog`, `react-dropdown-menu`,
  `react-avatar`, `react-separator`, `react-slot`
- `sonner` (toasts)
- `class-variance-authority`, `clsx`, `tailwind-merge`

**Do NOT install** Framer Motion, Aceternity, react-spring, or any animation
library. Use Tailwind transitions/keyframes and CSS animations only.

---

## 2. Goal

Redesign the public landing page at `/` to look closer to
[https://solvai.framer.ai/](https://solvai.framer.ai/) — dense, sectioned,
with feature cards, process steps, pricing, testimonials, FAQ, final CTA — but
**positioned for Mushu's actual value prop**: Instagram-only automation,
open-source, self-hostable, free for self-hosters, with a hosted SaaS option.

The current `/` is a centered hero with a logo + 2 CTAs. It must be replaced
with a multi-section scroll page modeled on Solv AI's structure.

**Tone**: confident but honest. Mushu is pre-alpha and IG-only by design —
that's a feature, not a limitation. No hype, no vague "AI-powered". State
exactly what works today and what's coming.

---

## 3. Files to touch

### Replace (full rewrite)

- [`apps/web/src/app/page.tsx`](../../apps/web/src/app/page.tsx) — currently
  a tiny centered hero, replace with the new sectioned landing.

### Edit (add new keys, do not break existing)

- [`apps/web/messages/pt-BR.json`](../../apps/web/messages/pt-BR.json) — under
  the existing `landing` namespace, add the new keys listed in §6 below.
- [`apps/web/messages/en.json`](../../apps/web/messages/en.json) — same shape,
  EN content from §6.

### Create new (small components, used only by the landing)

Each section should be its own server component to keep `page.tsx` readable.
Place them in `apps/web/src/components/landing/`:

- `landing-nav.tsx` — sticky top nav
- `hero-section.tsx`
- `benefits-section.tsx`
- `features-section.tsx`
- `process-section.tsx`
- `use-cases-section.tsx`
- `pricing-section.tsx` (only if you ship pricing — see §5.6)
- `testimonials-section.tsx` (skip if no real testimonials available — see §5.7)
- `faq-section.tsx`
- `cta-section.tsx`
- `landing-footer.tsx`

If a section is omitted (testimonials, pricing) per §5, do not create the file.
**Do not invent fake testimonials.**

### Do NOT touch

- Anything under `apps/web/src/app/(app)/`, `(auth)/`, `(legal)/`
- `apps/worker/`
- `packages/db/`, `packages/shared/`
- `auth.ts`, `auth-client.ts`
- The flow builder, settings, dashboard

---

## 4. Visual reference & design system

**Reference**: Solv AI's landing structure (sectioned, dense, dark, with
cinematic backgrounds and glass-effect UI cards). See `solvai-reference.html`
in this folder if available, or visit `https://solvai.framer.ai/`.

**Mushu palette — use existing tokens, do not invent**

These are already defined in [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css):

| Token | Dark value | Light value | Use for |
| --- | --- | --- | --- |
| `--color-mushu-scarlet` | `#c73e1d` | `#c73e1d` | Primary CTA, accent |
| `--color-mushu-scarlet-soft` | `#e15a3a` | `#e15a3a` | Hover, gradient end |
| `--color-mushu-amber` | `#ffc107` | `#f59e0b` | Tag/eyebrow text, focus rings |
| `--color-mushu-bg` | `#0a0a0b` | `#ffffff` | Page bg |
| `--color-mushu-surface` | `#141416` | `#f8f8f7` | Card bg |
| `--color-mushu-surface-hover` | `#1c1c20` | `#efefee` | Hover state |
| `--color-mushu-border` | `#26262a` | `#e4e4e7` | Card borders |
| `--color-mushu-border-subtle` | `#1d1d20` | `#ededee` | Hairlines |
| `--color-mushu-ink` | `#f5f5f4` | `#18181b` | Body text |
| `--color-mushu-mute` | `#8b8b8e` | `#52525b` | Secondary text |
| `--color-mushu-faint` | `#5a5a5e` | `#a1a1aa` | Tertiary, captions |

Use them via `bg-[var(--color-mushu-bg)]`, `text-[var(--color-mushu-ink)]`,
etc — **never hardcode** `#fff`, `text-white`, `bg-zinc-900`. Both light and
dark themes must look intentional.

**Solv AI visual idioms to mimic**:

1. **Eyebrow tags** — small uppercase text in scarlet/amber with a left border:
   `border-l border-[var(--color-mushu-scarlet)] pl-3 text-xs font-mono uppercase tracking-wider text-[var(--color-mushu-scarlet)]`
2. **Card gradients** — radial gradient on dark cards:
   `bg-[radial-gradient(50%_75%_at_50%_0,#1a1213,var(--color-mushu-surface))]`
   (dark only; in light mode use plain surface).
3. **Glass panels** — `backdrop-blur-md bg-[color-mix(in_srgb,var(--color-mushu-surface)_70%,transparent)] border border-[var(--color-mushu-border)]`
4. **Subtle hairlines between sections** — `border-t border-[var(--color-mushu-border-subtle)]`
5. **Scarlet→amber gradient on the primary CTA**:
   `bg-gradient-to-b from-[var(--color-mushu-scarlet)] to-[var(--color-mushu-scarlet-soft)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_-8px_rgba(199,62,29,0.5)]`
6. **Section padding**: desktop `py-24 px-6 lg:px-16`, mobile `py-16 px-4`.
   Max content width `max-w-6xl mx-auto`.

**Typography**:

- Headings: Inter, weights 500-700, tight tracking (`tracking-tight`)
- Body: Inter 400-500
- Eyebrow tags: Inter uppercase 500 with wide tracking, OR mono if you want
  the Solv AI feel — use `font-mono` (system stack will fall back to Menlo etc.)
- No new fonts. Inter is already loaded.

**Responsiveness**: mobile-first. Breakpoints: `sm:` 640, `md:` 768, `lg:`
1024, `xl:` 1280. Test on 360px width minimum.

---

## 5. Section-by-section spec

Total sections: **9**, in this order. Each is a server component that takes
no props (it calls `getTranslations` itself).

> **i18n**: every user-visible string must come from `t('landing.<key>')`.
> Build the JSON tree as you go (see §6 for the full schema).

### 5.1 Sticky top nav (`landing-nav.tsx`)

- Sticky to top, `backdrop-blur` background, hairline border bottom.
- Left: Mushu logo (`/mushu-logo.png` 28px) + wordmark "Mushu".
- Center (desktop only, `lg:` and up): in-page anchor links — Recursos,
  Como funciona, Para quem é, FAQ.
- Right (desktop): `<LocaleToggle />` (see §5.1.1), then "GitHub" outline
  button, then "Entrar" primary scarlet button → `/login`.
- Mobile: logo + `<LocaleToggle />` + "Entrar" button. Hamburger menu
  optional, skip if it adds complexity.

### 5.1.1 Locale toggle (`landing/locale-toggle.tsx`)

This is the single source of language switching for **visitors who are not
logged in** (the whole landing audience). It must work without an account.

- **Why client component**: it calls a server action and refreshes. Mark
  `'use client'`.
- **Props**: `{ currentLocale: 'pt-BR' | 'en' }`. The parent (`page.tsx` and
  `landing-footer.tsx`) resolves it via `await getLocale()` from
  `next-intl/server` and passes it down.
- **Backend**: call the **existing** server action
  [`updateUserPreferences`](../../apps/web/src/actions/preferences.ts) from
  `@/actions/preferences` with `{ locale: 'pt-BR' | 'en' }`. **Do NOT create
  a new action or `/api/locale` route** — the existing action already
  handles visitors (sets cookie `mushu_locale` only) and logged-in users
  (cookie + DB write).
- **Behavior**: on click of the inactive segment, call the action then
  `router.refresh()` so server components re-render with the new locale.
  Wrap the action call in `useTransition` so the segment shows a pending
  state (lower opacity) while the refresh happens.
- **Layout**: segmented control, two buttons inline, separated by 1px
  divider:

  ```text
  ┌────────┬────────┐
  │   PT   │   EN   │   ← active = filled bg, inactive = transparent
  └────────┴────────┘
  ```

- **Styling**:
  - Container: `inline-flex items-center rounded-md border border-[var(--color-mushu-border)] p-0.5 text-xs font-medium`
  - Active button: `bg-[var(--color-mushu-surface)] text-[var(--color-mushu-ink)] rounded-[5px] px-2.5 py-1`
  - Inactive button: `text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)] px-2.5 py-1 transition-colors`
  - Use `aria-pressed={isActive}` and `aria-label={t('landing.nav.localeToggleLabel')}`
- **Where it appears**: top-right of the sticky nav AND in the footer
  (right-aligned, above the copyright strip). Same component, same props.
- **Mobile**: the toggle stays inline next to the "Entrar" button. If space
  is tight at 360px, the toggle wins — the GitHub button can collapse to
  just an icon.

### 5.2 Hero (`hero-section.tsx`)

Layout: full-width section with a dramatic background.

- **Background**: a generated image (see §7 image #1) covering the whole
  section, with a gradient overlay
  `bg-gradient-to-b from-transparent via-[var(--color-mushu-bg)]/60 to-[var(--color-mushu-bg)]`
  to fade into the page below.
- **Eyebrow**: `OPEN-SOURCE INSTAGRAM AUTOMATION` (PT: `AUTOMAÇÃO OPEN-SOURCE PRO INSTAGRAM`)
- **H1** (huge, `text-5xl lg:text-7xl`):
  - PT: "Seu Instagram no piloto automático. **Sem mensalidade por contato**."
  - EN: "Put your Instagram on autopilot. **No per-contact pricing.**"
  - The bolded part should wrap to the second line on desktop and use
    `text-[var(--color-mushu-scarlet)]` to highlight.
- **Sub** (max-w-2xl):
  - PT: "Mushu responde comentários, captura leads via DM e gerencia conversas
    24/7 — open-source, self-hosted, grátis pra sempre. Ou use a versão
    hospedada se preferir não cuidar da infra."
  - EN: "Mushu replies to comments, captures leads via DM, and manages
    conversations 24/7 — open-source, self-hosted, free forever. Or use the
    hosted version if you'd rather skip the infra."
- **CTAs**: primary `Entrar` → `/login` (scarlet gradient), outline
  `Ver no GitHub` → `https://github.com/jfeernandezo/mushu`.
- **Pre-alpha disclaimer** (small, below CTAs, `text-xs text-[var(--color-mushu-faint)]`):
  - PT: "Pré-alfa. Em modo de desenvolvimento do Meta — só usuários adicionados
    como testadores conseguem conectar Instagram por enquanto."
  - EN: "Pre-alpha. In Meta Development Mode — only users added as testers
    can connect Instagram for now."

### 5.3 Benefits / Why Mushu (`benefits-section.tsx`)

Grid of 6 cards, 3 columns on desktop, 1 on mobile. Each card: icon (lucide),
title, 1-2 line description.

- **Eyebrow**: `WHY MUSHU` / `POR QUE MUSHU`
- **H2**: "Built different on purpose" / "Feito diferente de propósito"
- **Sub**: "Six things that set Mushu apart from generic chatbot platforms."
  / "Seis coisas que separam o Mushu de plataformas de chatbot genéricas."

The 6 cards (icon name from lucide-react):

1. **Free forever (self-hosted)** / **Grátis pra sempre (self-hosted)** —
   icon `Heart`. "Run it on your own VPS. No per-contact pricing, no AI step
   fees, no surprises." / "Rode na sua própria VPS. Sem cobrança por contato,
   sem taxa por etapa de IA, sem surpresas."
2. **Instagram-focused** / **Foco no Instagram** — icon `Instagram`. "We do
   one channel really well instead of 5 channels poorly." / "A gente faz um
   canal muito bem em vez de 5 canais mal feitos."
3. **Visual flow builder** / **Construtor visual de fluxos** — icon
   `GitBranch`. "Drag, drop, connect. Comment-keyword triggers, conditions,
   variables — all visual." / "Arrastar, soltar, conectar. Gatilhos por
   palavra-chave, condições, variáveis — tudo visual."
4. **Real conditions & variables** / **Condições e variáveis reais** — icon
   `Variable` (or `Braces`). "Capture an email in one flow, use it in the
   next. Branch by tag, value or membership." / "Captura um email num fluxo,
   usa no próximo. Ramifica por tag, valor ou membership."
5. **Open source AGPL** / **Código aberto AGPL** — icon `Github`. "Read every
   line. Fork it. Self-host it. Or use the hosted version — your call." /
   "Lê cada linha. Faz fork. Self-host. Ou usa a versão hospedada — você
   decide."
6. **Built for makers** / **Feito pra makers** — icon `Sparkles`. "Plain-
   language vocabulary, friendly errors, instant feedback. No engineer
   required." / "Vocabulário em linguagem natural, erros amigáveis, feedback
   imediato. Sem precisar de engenheiro."

Card styling: dark card with radial gradient bg, scarlet icon in a small
gradient pill, hover lifts slightly (`hover:-translate-y-0.5 transition`).

### 5.4 Features (`features-section.tsx`)

3 to 4 large feature cards in a 2-column grid (1 on mobile). Each card
contains a screenshot OR a representative UI mockup as image, plus a title +
short description below.

- **Eyebrow**: `FEATURES` / `RECURSOS`
- **H2**: "Everything you need to automate IG conversations" / "Tudo o que
  você precisa pra automatizar conversas no IG"
- **Sub**: "Triggers, actions, logic, and a real state machine that doesn't
  drop runs when you re-publish." / "Gatilhos, ações, lógica, e uma state
  machine de verdade que não perde execução em meio a um re-deploy."

The 4 cards:

1. **Comment-to-DM automation** / **Automação Comentário → DM**
   "When someone comments a keyword on your post, reply publicly *and* send
   them a DM with whatever you want — link, lead capture form, anything."
   "Quando alguém comenta uma palavra no seu post, responde publicamente *e*
   manda um DM com o que você quiser — link, formulário de captura, qualquer
   coisa."
   Image: §7 image #2 (flow builder canvas screenshot or mockup).

2. **Capture leads via DM** / **Captura de leads via DM**
   "The `Ask question` block sends a DM, waits for the reply, validates it
   (email/phone/number), and saves it on the contact. Use `{{email}}` in any
   later message."
   "O bloco `Perguntar` manda DM, espera a resposta, valida (email/telefone/
   número) e salva no contato. Usa `{{email}}` em qualquer mensagem depois."
   Image: §7 image #3 (ask-question block + DM mockup).

3. **Real conditions & branches** / **Condições e ramos de verdade**
   "Branch by `equals`, `contains`, `has_tag`, `gt`, `lt` and 5 more
   operators. AND/OR grouping. Last branch is the implicit `else`."
   "Ramifica por `igual`, `contém`, `tem_tag`, `maior_que`, `menor_que` e
   mais 5 operadores. Agrupamento E/OU. Último ramo é o `senão` implícito."
   Image: §7 image #4 (condition inspector mockup).

4. **3 starter templates** / **3 templates iniciais**
   "Comment→DM with link, Lead capture, Welcome DM. Pick one, edit two text
   fields, hit Publish. ~60 seconds from signup to live automation."
   "Comentário→DM com link, Captura de lead, Boas-vindas. Escolhe um, edita
   dois campos, clica Publicar. ~60 segundos do signup até automação no ar."
   Image: §7 image #5 (template picker dialog screenshot).

Card styling: image fills top half of card (16:10 aspect ratio), text
section below with title + description. Border + radial gradient as before.

### 5.5 Process / How it works (`process-section.tsx`)

3 numbered steps in a vertical list (or 3-column grid on desktop).

- **Eyebrow**: `HOW IT WORKS` / `COMO FUNCIONA`
- **H2**: "From signup to live in 5 minutes" / "Do cadastro ao ar em 5 minutos"

Steps:

1. **Connect your Instagram** / **Conecta seu Instagram** — "OAuth via Meta.
   Pick the Instagram Business account you want to automate. Token is stored
   encrypted (AES-256-GCM)." / "OAuth pelo Meta. Escolhe a conta Instagram
   Business que você quer automatizar. Token é guardado criptografado
   (AES-256-GCM)."
2. **Pick a template or start blank** / **Escolhe um template ou começa do
   zero** — "3 starter templates cover the common cases. Or drag triggers and
   actions onto the canvas yourself." / "3 templates cobrem os casos comuns.
   Ou arrasta gatilhos e ações no canvas do seu jeito."
3. **Edit, validate, publish** / **Edita, valida, publica** — "Friendly
   pre-publish validation catches the obvious stuff (no trigger, empty
   message, disconnected step) before the flow goes live." / "Validação
   amigável antes de publicar pega os erros óbvios (sem gatilho, mensagem
   vazia, etapa solta) antes do fluxo entrar no ar."

Visual: each step has a numbered circle (`01`, `02`, `03`) in scarlet, an
icon, title, description. Connecting line between steps on desktop.

### 5.6 Pricing (`pricing-section.tsx`) — **OPTIONAL, see decision below**

**Decision before writing**: skip pricing for now if the hosted SaaS is not
yet open to the public (Meta App Review pending). Replace this section with
a single "How to use Mushu" section with two cards: Self-host (free, AGPL) vs
Hosted (waitlist link).

Recommended for current state (replace pricing entirely):

- **Eyebrow**: `TWO WAYS TO USE MUSHU` / `DUAS FORMAS DE USAR O MUSHU`
- **H2**: "Pick your path" / "Escolhe seu caminho"

Two cards side by side:

**Self-host (free forever)** / **Self-host (grátis pra sempre)**
- Price: "Free" / "Grátis" — big.
- Features list (with check icons):
  - Full feature parity with hosted / Funcionalidade idêntica à hospedada
  - Bring your own Meta app, your own VPS / Seu próprio app Meta, sua VPS
  - AGPL-3.0 license / Licença AGPL-3.0
  - Community support / Suporte comunitário
- CTA: "Read the self-hosting guide" → `/docs/SELF_HOSTING.md` (link to
  GitHub blob URL `https://github.com/jfeernandezo/mushu/blob/main/docs/SELF_HOSTING.md`)

**Hosted (waitlist)** / **Hospedado (lista de espera)**
- Price: "TBD" / "A definir" + small "Coming after Meta App Review approval"
- Features list:
  - Zero infra to manage / Zero infra pra você gerenciar
  - Auto-updates and security patches / Updates automáticos e patches
  - Priority support / Suporte prioritário
  - Pricing TBD before public launch / Preço a definir antes do lançamento público
- CTA disabled or `Join waitlist` (mailto link to `adm@rayastudio.com.br` if
  no form available)

### 5.7 Testimonials — **SKIP**

Do not generate fake testimonials. If we don't have real quotes from real
users yet, omit this section entirely. (Solv AI fakes theirs; we shouldn't.)

### 5.8 FAQ (`faq-section.tsx`)

Accordion of 6 questions, 2-column grid on desktop, single column on mobile.
Use `<details>` and `<summary>` elements (native, no JS, accessible).

- **Eyebrow**: `FAQ`
- **H2**: "Straight answers" / "Respostas diretas"

Questions:

1. **Why is Mushu pre-alpha?** / **Por que o Mushu é pré-alfa?**
   "We're stable enough to use, but the schema and API still change without
   notice. Don't bet a production workload on it yet. We'll mark `1.0` when
   we've shipped Phase 5 of the public roadmap."
   "É estável o suficiente pra usar, mas o schema e a API ainda mudam sem
   aviso. Não aposte produção nele ainda. A gente marca `1.0` quando
   entregar a Fase 5 do roadmap público."

2. **Is the hosted version ready?** / **A versão hospedada está pronta?**
   "Almost. We're in Meta Development Mode while App Review is in progress.
   Once approved, we'll open the hosted version. Until then, only Instagram
   users we add as testers can connect their account."
   "Quase. Estamos em Modo de Desenvolvimento do Meta enquanto o App Review
   anda. Liberada a revisão, abrimos a hospedada. Até lá só usuários do
   Instagram que adicionarmos como testadores conseguem conectar."

3. **Does it work with WhatsApp / Messenger / email?** / **Funciona com
   WhatsApp / Messenger / email?**
   "No. Mushu is Instagram-only by design. We'd rather do one channel
   excellently than five channels poorly."
   "Não. Mushu é Instagram-only de propósito. Preferimos fazer um canal
   excelente do que cinco mal feitos."

4. **What happens if Meta changes the Instagram API?** / **E se o Meta mudar
   a API do Instagram?**
   "We update the open-source code. Self-hosters pull and re-deploy. Hosted
   users get the update automatically. The license is AGPL — you're never
   locked in."
   "A gente atualiza o código open-source. Self-hosters fazem pull e
   re-deploy. Usuários da hospedada pegam o update automaticamente. Licença
   é AGPL — você nunca fica preso."

5. **Can I migrate from ManyChat?** / **Dá pra migrar do ManyChat?**
   "Not automatically yet. The starter templates cover the most common
   ManyChat patterns. A migration import is on the roadmap (Phase 5)."
   "Automaticamente, ainda não. Os templates iniciais cobrem os padrões mais
   comuns do ManyChat. Import de migração está no roadmap (Fase 5)."

6. **Where is data stored?** / **Onde os dados ficam?**
   "Self-hosted: in *your* Postgres. Hosted: on our servers in Brazil. IG
   tokens are AES-256-GCM encrypted at rest in both cases."
   "Self-hosted: no *seu* Postgres. Hospedado: nossos servidores no Brasil.
   Tokens IG ficam criptografados AES-256-GCM em repouso nos dois casos."

### 5.9 Final CTA (`cta-section.tsx`)

Wide section with a generated background image (see §7 image #6), centered
text, single CTA.

- **H2** (large, centered, max-w-2xl):
  - PT: "Pronto pra começar?"
  - EN: "Ready to start?"
- **Sub**: "5 minutes from clone to running flow." / "5 minutos do clone ao
  fluxo no ar."
- **CTA**: primary scarlet gradient — `Entrar` → `/login` — same style as the
  hero CTA.

### 5.10 Footer (`landing-footer.tsx`)

3 columns + bottom strip.

- Column 1: Mushu logo + wordmark, 1-line tagline, GitHub icon link.
- Column 2: **Project** / **Projeto** — Features (anchor), How it works
  (anchor), Roadmap (link to GitHub README#roadmap), Self-hosting
  (link to docs).
- Column 3: **Legal** — Privacy (`/privacy`), Terms (`/terms`), Data deletion
  (`/data-deletion`), AGPL license (link to GitHub LICENSE).
- Column 4 (or 3rd row): **Built by** [Raya Studio](https://rayastudio.com.br) —
  small.
- Bottom strip: copyright `© 2026 Mushu` + `Pre-alpha · Hosted by Raya Studio`.

Already exists: [`apps/web/src/components/legal-links.tsx`](../../apps/web/src/components/legal-links.tsx) — reuse it.

---

## 6. i18n keys to add

Append to the `landing` namespace in **both**
[`apps/web/messages/pt-BR.json`](../../apps/web/messages/pt-BR.json) and
[`apps/web/messages/en.json`](../../apps/web/messages/en.json). **Keep the
existing keys** (`tagline`, `signIn`, `github`, `preAlpha`) — the new
landing's hero replaces tagline, but they're still referenced from auth
pages and footer.

Schema (build it nested, not flat):

```jsonc
"landing": {
  // existing keys (keep)
  "tagline": "...",
  "signIn": "...",
  "github": "...",
  "preAlpha": "...",

  // new keys
  "nav": {
    "features": "...",
    "howItWorks": "...",
    "useCases": "...",
    "faq": "...",
    "github": "...",
    "signIn": "...",
    "localeToggleLabel": "...",   // PT: "Idioma" / EN: "Language" (used as aria-label)
    "localePtLabel": "PT",         // same in both files (abbrev)
    "localeEnLabel": "EN"          // same in both files (abbrev)
  },
  "hero": {
    "eyebrow": "...",
    "titleLine1": "...",
    "titleLine2": "...",         // the highlighted scarlet part
    "subtitle": "...",
    "ctaPrimary": "...",
    "ctaSecondary": "...",
    "preAlphaNote": "..."
  },
  "benefits": {
    "eyebrow": "...",
    "title": "...",
    "subtitle": "...",
    "cards": {
      "free": { "title": "...", "body": "..." },
      "instagram": { "title": "...", "body": "..." },
      "builder": { "title": "...", "body": "..." },
      "logic": { "title": "...", "body": "..." },
      "openSource": { "title": "...", "body": "..." },
      "makers": { "title": "...", "body": "..." }
    }
  },
  "features": {
    "eyebrow": "...",
    "title": "...",
    "subtitle": "...",
    "cards": {
      "commentToDm": { "title": "...", "body": "...", "alt": "..." },
      "leadCapture": { "title": "...", "body": "...", "alt": "..." },
      "conditions": { "title": "...", "body": "...", "alt": "..." },
      "templates": { "title": "...", "body": "...", "alt": "..." }
    }
  },
  "process": {
    "eyebrow": "...",
    "title": "...",
    "steps": {
      "connect": { "title": "...", "body": "..." },
      "build": { "title": "...", "body": "..." },
      "publish": { "title": "...", "body": "..." }
    }
  },
  "ways": {                     // replaces pricing
    "eyebrow": "...",
    "title": "...",
    "selfHost": {
      "title": "...",
      "price": "...",
      "features": ["...", "...", "...", "..."],
      "cta": "..."
    },
    "hosted": {
      "title": "...",
      "price": "...",
      "priceNote": "...",
      "features": ["...", "...", "...", "..."],
      "cta": "..."
    }
  },
  "faq": {
    "eyebrow": "...",
    "title": "...",
    "items": {
      "preAlpha": { "q": "...", "a": "..." },
      "hosted": { "q": "...", "a": "..." },
      "channels": { "q": "...", "a": "..." },
      "metaApi": { "q": "...", "a": "..." },
      "migration": { "q": "...", "a": "..." },
      "data": { "q": "...", "a": "..." }
    }
  },
  "cta": {
    "title": "...",
    "subtitle": "...",
    "button": "..."
  },
  "footer": {
    "tagline": "...",
    "project": {
      "title": "...",
      "features": "...",
      "howItWorks": "...",
      "roadmap": "...",
      "selfHosting": "..."
    },
    "legal": {
      "title": "...",
      "privacy": "...",
      "terms": "...",
      "dataDeletion": "...",
      "license": "..."
    },
    "builtBy": "...",
    "copyright": "..."
  }
}
```

Use the section content from §5 verbatim to populate. For arrays (e.g.
`selfHost.features`), keep them as JSON arrays — call them via `t.raw()` in
the component.

---

## 7. Image generation prompts (for Image 2)

Generate these 6 images. Save them under `apps/web/public/landing/` with the
exact filenames below. Reference them via `next/image` with explicit width
and height.

### Image #1 — Hero background (`hero-bg.webp`, 2400×1400, dark)

> A cinematic dark scene: a tiny stylized red dragon (Mushu mascot, friendly,
> chibi proportions) sitting on top of an old CRT monitor that displays a
> glowing Instagram-style chat interface. The room is dark with deep crimson
> ambient light. Volumetric fog, warm rim lighting on the dragon. Cyberpunk
> indie-game vibe, painterly digital art style. Composition leaves the upper
> 60% of the image relatively dark and clear (text overlay area). Color
> palette: deep blacks (#0a0a0b), dark crimson (#6b0e08), accent scarlet
> (#c73e1d) and warm amber (#ffc107) on highlights. No logos, no text in
> image.

### Image #2 — Feature card: Comment-to-DM (`feature-comment-dm.webp`, 1600×1000)

> Stylized UI mockup: split screen showing a blurred Instagram post with a
> highlighted comment "quero o link" on the left, and a DM thread on the
> right where the same user receives an automated reply with a link card.
> Floating arrow/automation flow connecting them. Dark UI background
> (#141416), subtle scarlet accent on connecting line. Clean, modern, NOT
> photo-realistic — illustrative UI style. No real Instagram logos (avoid
> trademarks); stylized purple-pink-orange gradient post placeholder.

### Image #3 — Feature card: Lead capture via DM (`feature-lead-capture.webp`, 1600×1000)

> Stylized UI mockup of a phone-shaped DM conversation: bot asks "Qual seu
> e-mail?" and user replies with an email; bot then sends a follow-up using
> the captured email like "Beleza, te mando no joao@example.com". Floating
> labeled chip "{{email}} captured" hovering above the conversation. Dark
> background, scarlet accent on the chip. Illustrative, not photo-realistic.

### Image #4 — Feature card: Conditions & branches (`feature-conditions.webp`, 1600×1000)

> Stylized UI mockup of a condition node with two branches (paths) splitting
> downward — one labeled `tem_tag: lead-quente` going to a "send DM" node,
> another labeled `senão` going to "wait + retry". Looks like a flow editor
> canvas. Dark background, scarlet for active branch, faint gray for the
> default branch. Subtle dot grid behind. Crisp lines, illustrative.

### Image #5 — Feature card: Templates (`feature-templates.webp`, 1600×1000)

> Stylized UI mockup of a modal dialog titled "Como você quer começar?" with
> 4 cards visible: "Responder comentário", "Capturar lead", "Boas-vindas",
> "Começar do zero". Each card has a small icon + title + 1-line subtitle.
> Dark dialog on a slightly blurred page background. Scarlet hover state on
> the first card. Illustrative UI style.

### Image #6 — CTA background (`cta-bg.webp`, 2400×900, dark)

> The same little red dragon (Mushu) from image #1, this time perched on a
> mountaintop at sunset, looking out over a valley filled with low clouds.
> Sky gradient: deep red at horizon, fading to dark navy at the top. Warm
> rim light on the dragon. Same painterly indie-game style, slightly warmer
> overall than the hero. Leaves the center mostly clear for text overlay.
> No logos, no text.

> Style consistency note: all 6 images should feel like they belong in the
> same indie-pixel-art-meets-painterly universe — same dragon character
> across #1 and #6, same UI mockup language across #2-#5.

---

## 8. Constraints & gotchas

1. **Server components by default**. Use `'use client'` only for the locale
   toggle (if any) or interactive bits. The accordion uses `<details>`, no
   JS needed.
2. **`getTranslations`** in server components, not `useTranslations`.
3. **No `<a>` for in-app navigation** that points to `/login` etc — use
   `next/link`. External links (`github.com`, `rayastudio.com.br`) are fine
   as `<a target="_blank" rel="noopener">`.
4. **`next/image`** for all images, with explicit `width` + `height` and
   meaningful `alt` text (also from i18n).
5. **Reduce CLS** — set explicit dimensions, use `priority` on the hero
   image only.
6. **No emojis** in code or in user-facing content (project rule).
7. **Existing redirect**: keep the early `if (session) redirect('/dashboard')`
   logic at the top of `page.tsx` — logged-in users skip the landing.
8. **i18n keys**: every string. Don't ship anything hardcoded.
9. **Light mode must look intentional**, not just "dark mode minus".
   Test by toggling `[data-theme="light"]` on `<html>` in DevTools.
10. **No new dependencies**. If you reach for one, explain in PR description
    why an existing primitive doesn't suffice.
11. **Existing landing keys** (`tagline`, `signIn`, `github`, `preAlpha`)
    must stay — they're imported elsewhere too.
12. **Smooth-scroll** for in-page anchors: add
    `html { scroll-behavior: smooth; scroll-padding-top: 5rem; }` to
    `globals.css`.
13. **Locale toggle** must use the **existing** server action
    `updateUserPreferences({ locale })` from
    [`apps/web/src/actions/preferences.ts`](../../apps/web/src/actions/preferences.ts) —
    do not create a new action, do not add an `/api/locale` route, do not
    reach for `next-intl`'s URL routing. The action already covers both
    visitors (sets cookie `mushu_locale` only) and logged-in users (cookie
    and DB write). Locales array, default, and cookie name are exported from
    [`apps/web/src/i18n/config.ts`](../../apps/web/src/i18n/config.ts) —
    reuse them, don't redefine.

---

## 9. Acceptance criteria

Before considering done, all of these must pass:

- [ ] `pnpm typecheck` clean across all 4 packages
- [ ] `pnpm --filter @mushu/web build` clean (Windows EPERM symlink warnings
      OK; "Compiled successfully" must show)
- [ ] `pnpm --filter @mushu/web dev` and visit `http://localhost:3000`:
  - [ ] All 9 sections render in order, no horizontal scroll at 360px width
  - [ ] Toggle theme (DevTools: set `data-theme="light"` on `<html>`) — both
        modes look polished, no white-on-white or black-on-black
  - [ ] All anchor links scroll to the right section
  - [ ] CTAs route correctly: `/login`, GitHub, etc
  - [ ] FAQ accordions expand/collapse without JS errors
  - [ ] No console errors, no React hydration warnings
  - [ ] All 6 generated images load (no broken-image icons)
- [ ] Switch language at `/settings/preferences` (after login) → re-visit
      `/`: all strings flip between PT-BR and EN. Note: hitting `/` while
      logged in redirects to `/dashboard`, so test the language flip in an
      incognito tab or after logout.
- [ ] Lighthouse mobile run: Performance ≥ 80, Accessibility ≥ 95,
      Best Practices ≥ 95, SEO ≥ 95.
- [ ] No new dependencies added to `apps/web/package.json`.

---

## 10. Out of scope

- A/B testing infrastructure
- Analytics integration
- Newsletter signup form (no email infra wired up yet)
- Real testimonials (we don't have any yet)
- Pricing page proper (replaced by §5.6 "two ways to use")
- Blog
- Changelog page
- A separate "Roadmap" page (link to GitHub README section instead)

---

## 11. Reference files in the repo (for context)

- [`apps/web/src/app/page.tsx`](../../apps/web/src/app/page.tsx) — current minimal landing (replace this)
- [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css) — design tokens
- [`apps/web/messages/pt-BR.json`](../../apps/web/messages/pt-BR.json) — i18n source
- [`apps/web/messages/en.json`](../../apps/web/messages/en.json) — i18n source
- [`apps/web/src/components/legal-links.tsx`](../../apps/web/src/components/legal-links.tsx) — reuse in footer
- [`apps/web/src/lib/auth.ts`](../../apps/web/src/lib/auth.ts) — auth wiring (don't modify)
- [`apps/web/public/mushu-logo.png`](../../apps/web/public/mushu-logo.png) — existing logo

End of prompt.
