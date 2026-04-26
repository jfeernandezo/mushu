# Mushu

> Alternativa open-source ao ManyChat — automação de Instagram, self-hosted.

Leia em: [English](README.md) · [Português](README.pt-BR.md)

Mushu é seu pequeno dragão leal pra automação no Instagram: DMs disparados por
palavra-chave, respostas em comentários, captura de leads via conversa e
tagueamento de contatos — tudo rodando na sua VPS, grátis pra sempre pra quem
auto-hospeda. A versão hospedada vive em
[mushu.rayastudio.com.br](https://mushu.rayastudio.com.br).

## Status

**Pre-alpha.** Schema e APIs ainda mudam sem aviso. Não aposte uma carga de
produção nele ainda.

A instância hospedada está em **Modo de Desenvolvimento do Meta** (App Review
em andamento) — só usuários do Instagram explicitamente adicionados como
testadores conseguem autenticar e conectar a conta. Forks self-hosted precisam
do próprio app Meta.

## O que é o Mushu?

Mushu é uma plataforma de chatbot focada em Instagram que você pode
auto-hospedar. Faz o que o ManyChat faz pra IG — automações de comentário pra
DM, gatilhos por palavra-chave, fluxos multi-step, captura de leads — sem
precificação por contato e sem vendor lock-in.

Existe porque em março de 2026 o ManyChat reduziu o tier gratuito de 1.000
contatos pra 25 e começou a cobrar US$ 29/mês por etapas com IA. A gente acha
que um único canal como o Instagram deveria ser grátis e auto-hospedável.
Foco exclusivo em IG (sem WhatsApp, sem e-mail, sem SMS) pra atender muito bem
esse canal.

## Funcionalidades

### Autenticação e contas

- Login por e-mail/senha via Better Auth 1.6.9.
- Workspaces multi-tenant — auto-criadas no signup via hook
  `databaseHooks.session.create.before` em
  [auth.ts](apps/web/src/lib/auth.ts) pra ninguém ficar travado sem
  workspace ativa.
- Gestão de sessões: lista as ativas, revoga uma a uma ou todas as outras,
  badge "esta sessão".
- Formulários de perfil e troca de senha.
- Exclusão de conta self-service (Better Auth `deleteUser`).
- Logout pelo dropdown do avatar no topo E botão dedicado em `/settings`.

### Internacionalização

- Cobertura completa de pt-BR + EN (~300+ chaves) — toda string user-facing.
- Trocar idioma em `/settings/preferences`. Persiste em `user.locale` e
  espelha num cookie pra evitar round-trip dos server components.
- Powered by next-intl 4.9.1, configurado **sem** prefixo na URL (`/login`,
  não `/pt-BR/login`).

### Tema

- Modo Claro, Escuro e Sistema.
- Script inline anti-FOUC no `<html>` lê o cookie e aplica `data-theme`
  antes do React montar.
- Persiste em `user.theme` quando logado; cai pro cookie caso contrário.
- Recharts e ReactFlow lêem suas paletas de um `theme-colors.ts`
  compartilhado pra que gráficos e canvas reskin junto com o tema.

### Notificações

- Tabela `notification` no DB — eventos persistem mesmo se o worker
  reiniciar.
- Sino no topnav com badge de não-lidas, dropdown com as últimas N e
  polling de 30 segundos.
- Página completa em `/notifications` com mark-all-as-read.
- Geradas em momentos importantes — ex.: quando uma conta Instagram é
  conectada. Eventos futuros (erros do worker, tokens expirando) plugam no
  mesmo lugar.

### Páginas legais

- `/privacy`, `/terms` e `/data-deletion` lêem identidade da empresa de env
  vars (`LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_CNPJ`, `LEGAL_CONTACT_EMAIL`,
  etc).
- Um fork self-hosted usa **a própria** entidade legal — nunca suba com o
  CNPJ do upstream. Veja [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) pra
  lista de envs.
- Texto alinhado à LGPD pra mercado brasileiro.

### Construtor de fluxos (visual)

- Canvas drag-and-drop em [@xyflow/react](https://reactflow.dev/).
- Paleta com vocabulário amigável ("Quando comentarem no seu post", "Enviar
  mensagem privada"), nada de jargão técnico.
- Inspector contextual à direita. Canvas vazio mostra um CTA apontando pra
  paleta.
- **Templates de fluxo** com dialog seletor na criação: Comentário→DM,
  Captura de lead via DM, Boas-vindas no DM. Cada template já vem com
  defaults razoáveis que o usuário só ajusta.
- **Banner explicativo** em fluxos vindos de template — explica como editar,
  adicionar e remover etapas. Dispensável por fluxo via localStorage.
- **Validação amigável antes de publicar** com toasts ("Adicione pelo menos
  um gatilho…", "Tem uma ação com mensagem em branco…") — sem stack trace
  do Zod chegando ao usuário.
- Lista de fluxos: cards com badge Ativo/Rascunho e menu de 3 pontinhos com
  Ativar/Desativar/Excluir (delete pede confirmação via AlertDialog).

### Gatilhos (entrada do fluxo)

- `trigger.comment_keyword` — dispara em comentário que casa com uma ou
  mais palavras-chave. Inclui um **seletor de post** que busca os posts
  recentes da conta IG conectada via Graph API e mostra thumbnail +
  legenda + data, mais a opção "qualquer post da conta".
- `trigger.dm_keyword` — dispara em DM que case com palavras-chave.
- **Chip input de palavras-chave** — cada palavra é um chip removível;
  vírgula ou Enter adiciona, Backspace remove o último.
- **Match case + acento insensitive** por padrão — digitar `informação`
  também casa `informacao`, `INFORMACAO`, `Informação`. Implementado via
  normalização NFD em
  [trigger-matcher.ts](apps/worker/src/lib/trigger-matcher.ts).
- Preview ao vivo "Também casa: …" abaixo dos chips.

### Ações

- `action.send_dm` — envia DM. O texto suporta substituição `{{variavel}}`
  antes do envio.
- `action.reply_comment` — responde publicamente o comentário que disparou.
- `action.ask_question` — manda uma pergunta, pausa o fluxo, valida a
  resposta (`text` / `email` / `number` / `phone`) e salva numa variável.
  Manda fallback em resposta inválida com limite de tentativas
  configurável.
- `action.set_tag` — adiciona ou remove tag no contato.
- `action.set_custom_field` — escreve em `contact.customFields` (jsonb).

### Lógica

- `logic.delay` — pausa o fluxo por N segundos (até 30 dias).
- `logic.condition` — condicional multi-branch com 10 operadores
  (`equals`, `not_equals`, `contains`, `starts_with`, `gt`, `lt`, `is_set`,
  `is_empty`, `has_tag`, `not_has_tag`) e agrupamento E/OU. Cada caminho é
  avaliado em ordem; o último é o "senão" implícito.

### Controle

- `control.end` — encerra o fluxo limpamente.

### Variáveis e estado

- Placeholders `{{nome_variavel}}` em qualquer mensagem são substituídos
  imediatamente antes do envio.
- Ordem de lookup: `state.variables` (em execução, escopo do run) →
  `contact.customFields` (persistente por contato) → string vazia.
- Persistência por contato significa que uma variável capturada em um fluxo
  fica visível pra qualquer fluxo posterior atendendo a mesma pessoa —
  estilo "subscriber attributes" do ManyChat.

### Engine do worker

- State machine Postgres-backed em `flow_execution`.
- Status: `active` / `waiting` (delay) / `awaiting_input` (ask_question) /
  `done` / `failed` / `cancelled`.
- **Pause/resume**: `ask_question` parqueia o run como `awaiting_input`. O
  próximo DM do mesmo contato é interpretado como resposta por
  [`tryResumeAwaitingFlow`](apps/worker/src/processors/process-event.ts) —
  sem webhook adicional.
- Detecção de ciclo (`visitedNodes`) recusa reentrar num nó dentro da mesma
  execução.
- Lock de concorrência por execução (`isReplying`) impede que dois eventos
  de webhook corram a mesma run.
- Cada execução carrega o próprio `graphSnapshot` — re-publicar um fluxo
  não quebra runs em andamento.

## Stack

| Camada      | Tech                                                  |
| ----------- | ----------------------------------------------------- |
| Framework   | Next.js 15 (App Router, Server Actions, Turbopack)    |
| Linguagem   | TypeScript (strict)                                   |
| ORM / DB    | Drizzle ORM + Postgres 16                             |
| Fila        | BullMQ + Redis                                        |
| Auth        | Better Auth 1.6.9 (organizations plugin)              |
| i18n        | next-intl 4.9.1                                       |
| Toasts      | Sonner 2.0.7                                          |
| Flow UI     | @xyflow/react 12.10                                   |
| Estilo      | Tailwind v4 (CSS vars + `@theme`)                     |
| UI prims    | Radix (Dialog, AlertDialog, DropdownMenu, Avatar)     |
| Ícones      | lucide-react                                          |
| Validação   | Zod 4                                                 |
| Lint/Format | Biome                                                 |
| Storage     | MinIO (S3-compatible)                                 |

## Arquitetura

```text
Webhook do Meta ─▶ /api/webhooks/instagram ─▶ Postgres (incoming_event)
                                              │
                                              ▼
                                          BullMQ (Redis)
                                              │
                                              ▼
                                    ┌── process-event ──┐
                                    │  awaiting_input?  │
                                    │       ↓ sim       │
                                    │  retoma o run     │
                                    │       ↓ não       │
                                    │  match triggers   │
                                    │  cria run novo    │
                                    └─────────┬─────────┘
                                              ▼
                                    ┌── execute-flow ───┐
                                    │ state machine:    │
                                    │  active → waiting │
                                    │       → awaiting  │
                                    │       → done      │
                                    │ render {{var}}    │
                                    │ avalia condições  │
                                    └─────────┬─────────┘
                                              ▼
                                    ┌── send-message ───┐
                                    │ chamada Graph API │
                                    │ guarda rate limit │
                                    └───────────────────┘
```

## Estrutura do projeto

```text
mushu/
├─ apps/
│  ├─ web/          # App Next.js (UI + rotas API + server actions)
│  └─ worker/       # Worker BullMQ (eventos + execução de fluxos)
├─ packages/
│  ├─ db/           # Schemas Drizzle + migrations + cliente db
│  └─ shared/       # Schemas Zod dos nós, renderer de template, crypto
├─ docs/            # SELF_HOSTING.md, PRD, notas de arquitetura
└─ docker-compose.yml
```

## Quick start (dev local)

```bash
# 1. Clone
git clone https://github.com/jfeernandezo/mushu.git
cd mushu

# 2. Instala
pnpm install

# 3. Configura env
cp .env.example .env
# edite o .env — no mínimo: META_APP_ID, META_APP_SECRET,
# INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, URL do ngrok pro webhook

# 4. Sobe a infra (postgres, redis, minio)
docker compose up -d postgres redis minio

# 5. Roda migrations
pnpm db:migrate

# 6. Sobe dev (web + worker)
pnpm dev
```

Web em <http://localhost:3000>; logs do worker no mesmo terminal.

> Nota sobre credenciais: `META_APP_ID` / `META_APP_SECRET` são os valores
> do Facebook App (usados pra verificar assinatura de webhook).
> `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` vêm da configuração do produto
> Instagram ("API setup with Instagram login") — são números **diferentes**.

## Self-hosting

Leia [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) **antes de expor sua
instância pra usuários**. As páginas legais lêem identidade da empresa de env
vars em runtime — nunca suba com o CNPJ do upstream nem com os valores
placeholder. Cada fork precisa do próprio app Meta, da própria chave de
encriptação (`TOKEN_ENCRYPTION_KEY`) e do próprio segredo do Better Auth
(`BETTER_AUTH_SECRET`).

## Roadmap

- ~~**Fase 1** — Variáveis, ask_question, condition real~~ — entregue
- **Fase 2** — Quick replies (botões dentro de DMs), gatilho Welcome DM
  (`trigger.first_dm`), wiring de set_tag no inspector, templates novos
  (boas-vindas no primeiro DM, comment-first-time)
- **Fase 3** — Wait for reply (`logic.wait_reply` com timeout +
  follow-up), gatilhos Story mention/reply, visão de Inbox (lista de
  conversas com tomada manual)
- **Fase 4** — Bloco Galeria/carrossel, bloco Webhook-out HTTP, bloco de
  IA (Anthropic Claude), tipos de input adicionais no ask_question,
  Broadcast (com compliance da janela de 24h da Meta), analytics por step,
  undo/redo no canvas
- **Fase 5** — Galeria extensa de templates (10–15 organizados por
  categoria)

O que não está listado aqui ainda pode acontecer — o roadmap evolui com o
que aprendemos no uso real.

## Licença

[AGPL-3.0-only](LICENSE). Licença comercial disponível — contato
<adm@rayastudio.com.br>.

## Construído por

[Raya Studio](https://rayastudio.com.br).
