# Mushu — Product Requirements Document

> Open-source ManyChat alternative — Instagram automation, self-hosted.
> Built by [Raya Studio](https://rayastudio.com.br).

| Campo | Valor |
|---|---|
| Status | Draft v0.1 |
| Owner | Júlio Fernandez (Raya Studio) |
| Last update | 2026-04-25 |
| Next review | 2026-05-25 (após MVP) |
| Public repo | github.com/rayastudio/mushu (TBD) |
| Hosted SaaS | mushu.rayastudio.com.br |
| License | AGPLv3 + commercial (contact `adm@rayastudio.com.br`) |

---

## 1. Visão executiva

Mushu é uma plataforma open-source de automação de Instagram para agências e
criadores. Replica os 80% mais usados do ManyChat (responder comentários,
sequências de DM, segmentação de contatos) e remove os 20% que não importam
(WhatsApp, email, SMS, e-commerce). É instalável em qualquer VPS via
`docker-compose` e licenciado como AGPLv3.

A Raya Studio mantém uma versão hospedada paga em mushu.rayastudio.com.br
para quem prefere pagar a operar infra, e revende o produto em modalidade
wholesale para agências que querem oferecer automação Instagram com
white-label próprio.

**TL;DR**

| Pergunta | Resposta curta |
|---|---|
| Quem é o cliente? | Agências de marketing pequenas/médias (5-15 funcionários, 10-30 clientes Instagram) e criadores/operadores solo |
| Que problema resolve? | ManyChat ficou caro (cortou tier grátis de 1000→25 contatos em mar/2026) e dados saem do Brasil |
| Por que vai vencer? | Open-source + self-hosted (LGPD) + foco extremo em Instagram + 100% em português |
| Como ganha dinheiro? | (1) SaaS hospedado pago, (2) wholesale white-label para agências, (3) suporte/setup pago |
| Quando lança v0.1? | 30 dias a partir de 2026-04-25 (alvo: 2026-05-25) |

---

## 2. Problema

### Dor concreta do usuário

Em março de 2026 o ManyChat cortou seu tier gratuito de 1000 contatos para 25
e adicionou um add-on de US$ 29/mês para uso de IA dentro de fluxos. Para uma
agência brasileira gerenciando 20 contas de Instagram com 500 contatos/conta,
o custo passou de zero para cerca de US$ 600/mês (R$ 3.000/mês com câmbio
abril/2026), em USD, com cobrança internacional.

Hoje, três caminhos existem:

1. **Pagar ManyChat** — funciona, mas em USD, sem nota fiscal local, sem
   suporte em português, e os dados de contatos brasileiros transitam por
   servidores fora do Brasil (problema de LGPD para agências que atendem
   clientes regulados como saúde, financeiro, jurídico).
2. **Construir em n8n** — funciona, mas exige VPS por cliente, conhecimento
   técnico, e cada cliente da agência precisa de uma instância separada para
   isolamento. É o que Júlio faz hoje com o fluxo `Agente IG [Contrast |
   Fernandez]`. Insustentável em escala.
3. **Não automatizar** — perda de leads diariamente. Comments sem resposta
   morrem. DMs frias entram na pasta "Solicitações" e nunca são vistas.

### Dor concreta do mercado

- ManyChat tem 1,5M+ usuários globais e cresce, mas o sentimento brasileiro
  azedou em comentários de fóruns/grupos pós-corte do tier grátis.
- Concorrentes diretos (Inrō, Spur) também são USD-first e sem suporte em
  português.
- Não existe nenhum SaaS brasileiro com flow builder visual focado em
  Instagram. O espaço está vazio.

### Tamanho do mercado (estimativa de fundo)

- Brasil tem ~140 milhões de usuários ativos no Instagram (2026).
- Agências brasileiras de marketing digital: ~25 mil (estimativa Sebrae +
  ABRADi).
- Criadores com 10k+ seguidores que monetizam: estimativa conservadora de
  500 mil.
- TAM acessível (agências + criadores que pagariam R$ 50-200/mês): R$ 50-200
  milhões/ano em receita potencial total.

---

## 3. Personas e ICP

### Persona primária — Agência de marketing pequena/média

**Renata, 32, sócia/operadora de agência em Curitiba**

- Equipe de 8 pessoas, 18 clientes ativos, R$ 80-150k/mês de faturamento.
- Hoje gerencia automações no ManyChat para 12 dos 18 clientes, paga
  ~US$ 300/mês.
- Não é técnica, mas mexe em Zapier, Make e ManyChat sem medo.
- Critérios de decisão: (1) preço previsível em reais, (2) emite NF, (3) os
  dados ficam no Brasil, (4) suporte em português, (5) consegue configurar
  sozinha sem depender de dev.
- Quer um único painel para gerenciar todas as contas de cliente, com
  separação visual e permissões por cliente.

### Persona secundária — Criador/operador solo

**Júlio, 30, social media + tráfego pago para clientes próprios**

- Roda 3-5 contas de Instagram (próprias e de clientes diretos).
- É vibe-code — não é dev, mas mexe em n8n, Zapier, Make.
- Não quer pagar US$ 30/mês. Topa pagar R$ 30-50/mês. Topa zero (self-host)
  se a UI for usável.
- Critérios de decisão: (1) preço, (2) facilidade de instalar, (3) a
  comunidade está crescendo, (4) tem comment→DM funcional, (5) idealmente
  consegue importar o n8n flow que já roda.

### Persona terciária — Dev open-source

**Lucas, 26, dev backend que mantém side projects no GitHub**

- Não é o cliente pagante, mas é quem manda PR e mantém momentum do
  projeto.
- Quer: (1) stack moderna (TypeScript, Postgres, sem frescura), (2) docs
  decentes, (3) issues bem rotuladas, (4) maintainer que responde, (5)
  licença que protege contra clones SaaS predatórios.
- Crítico para o flywheel OSS — sem contribuidores, projeto morre em 6
  meses.

### ICP do SaaS hospedado (mushu.rayastudio.com.br)

- **Quem assina:** Renata e Júlio.
- **Quem não assina (e tudo bem):** Lucas (vai self-hostar) e empresas
  enterprise (>200 contas IG simultâneas — não somos pra eles ainda).

### ICP do wholesale Raya

- Agências como a Raya — entre 5 e 30 clientes Instagram.
- Querem oferecer "automação Instagram" como serviço próprio sem ter que
  desenvolver.
- Faixa de fechamento: R$ 8.000-12.000 por implementação (modelo Raya:
  PRD 20% + MVP 30d 50% + Completa 30%) com licença comercial Mushu inclusa.

---

## 4. Solução e posicionamento

### O que Mushu é

- Um aplicativo web self-hostável que recebe webhooks do Instagram via Meta
  Graph API e dispara automações com base em fluxos visuais que o usuário
  desenha em uma UI estilo "node editor" (como ManyChat, n8n, Typebot).
- Multi-tenant ready — uma instância serve múltiplas organizações
  (modelo Better Auth + organization plugin).
- Stack 100% TypeScript, deploy em qualquer VPS com Docker.

### O que Mushu não é

- Não é multicanal. WhatsApp, Messenger, email, SMS, web chat: nunca.
  Foco é o moat. Quem quer multicanal: continua no ManyChat.
- Não é CRM. Não armazena pipeline de vendas, valor de deals, propostas.
  Integra com CRMs externos via webhook.
- Não é e-commerce. Sem catálogo, carrinho, checkout. Integra com
  Shopify/Hotmart/Kirvano via webhook se o usuário quiser.
- Não é uma plataforma de conteúdo. Não agenda posts, não publica stories,
  não gerencia calendário editorial.
- Não é um agente de IA conversacional autônomo. AI Step (v0.5) chama LLMs
  dentro de fluxos, mas o desenho é determinístico — quem decide o ramo é
  o flow, não o modelo.

### Diferenciação vs concorrência

| Recurso | Mushu | ManyChat | Chatfuel | n8n | Inrō/Spur |
|---|---|---|---|---|---|
| Open-source | Sim (AGPLv3) | Não | Não | Sim (custom) | Não |
| Self-hosted | Sim | Não | Não | Sim | Não |
| Comment→DM | Sim | Sim | Sim | Possível, manual | Sim |
| DM Sequences | Sim | Sim | Sim | Possível, manual | Sim |
| Multi-canal | Não (foco IG) | Sim | Sim | Sim | Não (foco IG) |
| Português nativo | Sim | Não | Não | Sim | Não |
| LGPD/dados no Brasil | Sim | Não | Não | Possível | Não |
| Pricing em BRL | Sim | Não | Não | Sim | Não |
| Free até 1000 contatos | Sim | Não (era, cortou) | Não | Sim | Não |

**Posicionamento de uma frase:** "O ManyChat brasileiro, open-source,
focado só em Instagram."

---

## 5. Features priorizadas (MoSCoW por release)

### v0.1 — MVP (lança 2026-05-25)

**Must have**

- Cadastro/login (email+senha via Better Auth)
- Conectar 1+ conta Instagram Business via OAuth Meta
- Webhook ingestion (verificação GET + POST com HMAC + dedupe por event_id)
- Flow builder visual (xyflow) com 6 tipos de bloco: Trigger Comment,
  Trigger DM Keyword, Send DM, Reply Comment, Delay, End
- Trigger matcher: comment com keyword em post específico, DM keyword
- Worker BullMQ + Redis processando filas com lock anti-concorrência
- Cliente Graph API com retry, rate limit (200/h por conta), respeito à
  janela de 24h da Meta
- Listagem de Contacts importados a partir de eventos
- Listagem de Flows + status (draft/published)
- Logs de execução por contato (debug)
- Self-host: `docker-compose up` em 5 minutos
- Documentação básica: README + setup guide

**Should have (entram se sobrar tempo)**

- Importador do JSON do n8n do Júlio (converter `Agente IG [Contrast |
  Fernandez].json` em flows Mushu nativos)
- Tema dark/light toggle
- 4 KPIs no dashboard (comments respondidos, DMs enviadas, contatos
  ativos, flows ao vivo)

**Won't have nesta release**

- Inbox / Live Chat (humano assume conversa)
- Broadcasts e Sequences drip
- AI Step
- External Request block (HTTP arbitrário)
- WhatsApp, Messenger, qualquer outro canal
- Billing (cobrança Stripe)
- White-label para agências

### v0.2 — Triggers extras (alvo: 2026-07)

- Trigger Story Reply
- Trigger Story Mention
- Trigger Ref URL (ig.me ref tracking)
- Bloco Randomizer (A/B split)
- Bloco Set Tag / Set Custom Field
- Bloco Condition (avaliação de tags + custom fields)
- Passkey/2FA no Better Auth
- Tema visual completo (Mushu vermelho/dourado em vez de placeholder)

### v0.3 — Inbox (alvo: 2026-09)

- Live Chat / Inbox UI (ver e responder DMs)
- Pause de automação 30 min quando humano envia mensagem
- Atribuição de conversas a operadores
- Notas internas (private messages)
- Realtime via SSE (Server-Sent Events) — sem websockets ainda

### v0.4 — Broadcasts e Sequences (alvo: 2026-11)

- Broadcasts segmentados por tag/custom field
- Sequences drip (mensagens disparadas X horas/dias após subscribe)
- Importador de contatos via CSV
- Exportador de contatos em CSV/JSON

### v0.5 — AI e External (alvo: 2027-01)

- Bloco AI Step (BYO key OpenAI/Anthropic/Gemini)
- Bloco External Request (HTTP arbitrário com mapeamento de resposta)
- Variáveis nos blocos (template `{{varName}}`)
- Bloco Webhook (chama URL externa quando o flow passa por ele)

### v0.6 — Camada SaaS Raya (alvo: 2027-03)

- Billing Stripe (planos Free, Pro, Agency)
- Rate limit por plano
- Dashboard admin para Raya gerenciar inquilinos
- Domínio custom para wholesale (`bot.cliente.com.br` → Mushu)
- White-label parcial: logo + cores do plano Agency

### v1.0 — Lançamento público (alvo: 2027-06)

- Polimento total da UI
- Documentação completa (manual + tutoriais em vídeo)
- Marketing site em mushu.app
- Programa beta com 20-30 agências
- Lançamento Product Hunt + comunidade brasileira

---

## 6. Métricas de sucesso

### North star metric

**Mensagens enviadas pelo Mushu por dia** — soma de comments respondidos +
DMs disparados em todas as instalações (self-host + SaaS Raya combinadas).

Por que: captura simultaneamente adoção (mais usuários = mais mensagens),
engajamento (mais flows ativos = mais mensagens), e valor entregue ao
cliente final (lead respondido é a unidade de valor).

### Drivers (input metrics)

- **Aquisição:** novos workspaces criados / semana (SaaS); novos clones
  GitHub / semana (OSS).
- **Ativação:** % de workspaces que conectam IG dentro de 24h da
  inscrição. Meta v0.1: 50%.
- **Engajamento:** % de workspaces que publicam pelo menos 1 flow em 7
  dias. Meta v0.1: 30%.
- **Retenção:** % de workspaces ainda ativos (1+ mensagem nos últimos 7
  dias) 30 dias após inscrição. Meta v0.2: 40%.

### Métricas operacionais (saúde do produto)

- **Latência comment → DM:** p95 < 5 segundos. Meta dura.
- **Webhook delivery success:** > 99,5% de eventos processados sem falha.
- **Rate limit hits:** < 0,5% de mensagens enfileiradas batem rate limit
  Meta.
- **Token expiry:** 0% de operadores recebem mensagens de "token
  expirado" (renovamos antes de expirar).

### Métricas de negócio (Raya)

- **Conversão SaaS:** % de signups que viram pagantes Pro+ em 30 dias.
  Meta v0.6: 8%.
- **Wholesale signed:** número de agências fechadas em modelo
  R$ 8-12k/implementação. Meta primeiros 6 meses pós-v0.6: 5 agências.
- **MRR self-hosted ARR pago:** receita anual recorrente a partir de
  licenças comerciais (não-AGPL). Meta v1.0: R$ 50k/ano.

---

## 7. Modelo de negócio

### Três fontes de receita complementares

1. **SaaS hospedado em mushu.rayastudio.com.br**
   - Free: até 1000 contatos, 1 conta IG, todos os blocos do MVP
   - Pro: R$ 49/mês — até 10.000 contatos, 3 contas IG, AI Step incluso
     (BYO key)
   - Agency: R$ 199/mês — até 50.000 contatos, 15 contas IG, white-label
     parcial, suporte prioritário
   - Enterprise: cotado caso a caso (>50k contatos, contratos anuais)

2. **Wholesale para agências (modelo Raya)**
   - PRD da automação custom (20% do valor): R$ 1.500-2.400
   - MVP em 30 dias (50% do valor): R$ 4.000-6.000
   - Versão completa (30% do valor): R$ 2.500-3.600
   - **Total: R$ 8.000-12.000 por implementação**
   - Inclui licença comercial Mushu (uso sem obrigação AGPL) + setup +
     1 mês de suporte
   - Vendido por Bruna (full-cycle)

3. **Licenciamento comercial individual**
   - Para empresas que querem usar Mushu em produto SaaS próprio sem
     publicar código (AGPL impede)
   - Pricing: por conversa Inicial: R$ 5.000/ano (até 100k contatos)
   - Cliente raro mas margem alta

### Custos do SaaS hospedado (Raya)

- VPS Hostinger: R$ 200-400/mês (escala com uso)
- Postgres + Redis + MinIO: incluso na VPS via Easypanel
- Domínio + Cloudflare: R$ 100/ano
- Custos Meta API: zero (hospedados pelo cliente em sua própria App ID)
- Suporte humano: 1-2h/semana de Júlio + Bruna conforme volume

Margem alvo Pro: ~70%. Agency: ~80%.

---

## 8. Não-objetivos (declarados)

Lista pública para alinhar contribuidores e evitar PR perdido:

1. **Multi-canal** (WhatsApp, Messenger, email, SMS, Telegram) — nunca.
   Quem quer multi-canal use ManyChat ou Chatwoot.
2. **CRM completo** — não vai ter pipeline, deals, contracts.
3. **E-commerce nativo** — sem catálogo, carrinho, checkout.
4. **Agendamento de posts** — sem feed, sem calendário, sem stories
   programados.
5. **Análise de hashtags / monitoramento de marca** — não somos brand
   monitoring tool.
6. **Apoiar conta pessoal Instagram** — só Business/Creator. Conta pessoal
   não está no contrato Meta.
7. **Mobile app** — web responsivo bom é suficiente. Não vamos publicar
   app nativo iOS/Android.
8. **Tradução para >2 idiomas no MVP** — PT-BR + EN. Outras línguas só
   via PR da comunidade.
9. **Integração com CRMs proprietários (Salesforce, HubSpot)** —
   integramos via webhook genérico, não SDKs proprietários.

---

## 9. Decisões técnicas (ADRs leves)

### ADR-001 — Linguagem: TypeScript em todo o stack

**Decisão:** TypeScript 5.9, Node 24+, em todo o monorepo.
**Motivo:** flow builder UI exige React Flow (`@xyflow/react`) que é
JS/TS-only. Manter um único idioma elimina duplicação de tipos
front↔back, reduz contexto necessário para contribuidores, e o ecossistema
brasileiro tem mais devs TypeScript que Python para esse caso.
**Alternativa rejeitada:** Python (FastAPI + Celery) com front separado
em React. Rejeitado por duplicação de tipos e overhead de manter dois
runtimes.

### ADR-002 — Framework: Next.js 15 full-stack

**Decisão:** Next.js 15 com App Router, Server Actions, Turbopack.
**Motivo:** 1 repo, 1 deploy, server actions cortam boilerplate de API
endpoints. Turbopack reduz tempo de dev em ~70%.
**Alternativa rejeitada:** Hono.js + React separado. Mais flexibilidade
mas mais código de plumbing.

### ADR-003 — Banco e ORM: Postgres 16 + Drizzle

**Decisão:** Postgres como banco único, Drizzle ORM 0.45+ como camada de
acesso.
**Motivo:** Drizzle gera tipos a partir do schema sem code gen pesado,
migrações em SQL puro são auditáveis, e Postgres 16 tem JSONB performante
para guardar o flow graph.
**Alternativa rejeitada:** Prisma. Mais maduro mas migrações mais
opacas, runtime mais pesado. Drizzle ganhou momentum em 2025-26.

### ADR-004 — Queue: BullMQ + Redis

**Decisão:** BullMQ sobre Redis para todas as filas (ingestion,
execution, sending).
**Motivo:** delays nativos, retry com backoff, observabilidade decente,
maturidade. n8n usa, ZernFlow usa cron Postgres (mais simples mas
limitado).
**Alternativa rejeitada:** scheduled_jobs em Postgres + cron. Mais
simples de operar mas escala pior e perde features (priority queues,
rate limiting nativo).

### ADR-005 — Auth: Better Auth 1.6 com plugin organization

**Decisão:** Better Auth, plugin organization para multi-tenant nativo.
**Motivo:** mais moderno que NextAuth, suporta multi-tenant out of the
box, ativo em 2026.
**Alternativa rejeitada:** Clerk (proprietário, lock-in), NextAuth
(legado, menos features de org).

### ADR-006 — Flow graph: JSON blob no Postgres, validado por Zod

**Decisão:** o grafo do flow (nodes + edges + viewport) é guardado como
coluna `jsonb` em `flow.draftGraph` e `flow.publishedGraph`, validado
por Zod discriminated union ao escrever/ler.
**Motivo:** padrão Typebot e ZernFlow. Evita 5+ tabelas relacionais
para representar o grafo. Casa com formato nativo do React Flow. Permite
versionar o graph snapshot junto com a flow_execution para que
re-publicações não quebrem execuções em curso.
**Alternativa rejeitada:** tabelas `block`, `edge`, `block_option`
relacionais. Mais "limpo" academicamente mas custa muito mais código.

### ADR-007 — Flow execution: split draft/published + isReplying lock

**Decisão:** cada `flow_execution` carrega seu próprio `graphSnapshot`
(cópia do `publishedGraph` no momento de início) e tem flag
`isReplying` (boolean) que serve como lock anti-concorrência.
**Motivo:** Meta pode entregar 2+ webhooks no mesmo contato em ms.
`UPDATE ... SET isReplying = true WHERE isReplying = false RETURNING`
implementa CAS atômico. Snapshot do graph protege execuções em curso de
mudanças no draft.

### ADR-008 — Janela de 24h Meta: enforced no worker, não no webhook

**Decisão:** webhook handler só persiste evento e enfileira job. O
worker, antes de chamar Graph API para enviar DM, verifica:
`conversation.lastIncomingAt > now() - 24h` OU evento atual veio de
`comment_keyword` (que abre janela in-thread). Se nenhum, falha a
mensagem com erro tipado.
**Motivo:** evita gastar rate limit em chamadas que vão falhar e gera
erros legíveis para o usuário no log.

### ADR-009 — Token IG: AES-256-GCM at rest

**Decisão:** access_token longo Meta é criptografado com AES-256-GCM
usando chave de 32 bytes (`TOKEN_ENCRYPTION_KEY` em env). Salvamos
ciphertext + iv + authTag em colunas separadas.
**Motivo:** dump do banco não vaza tokens. Chave fica fora do banco.
Rotação possível.

### ADR-010 — Licença: AGPLv3 + opção comercial

**Decisão:** AGPLv3 como licença OSS principal. Licença comercial paga
disponível para empresas que querem rodar Mushu como SaaS sem publicar
código modificado.
**Motivo:** AGPLv3 protege contra hyperscalers (AWS, Google) clonarem
e revenderem como serviço gerenciado sem contribuir de volta. Modelo
testado por Grafana, Mattermost, Plausible. Contribuidores individuais
não são afetados — a obrigação só ataca quem opera SaaS modificado.

### ADR-011 — Hospedagem: VPS Hostinger + Easypanel

**Decisão:** SaaS Raya rodará em VPS Hostinger gerenciada via
Easypanel, com Postgres, Redis, MinIO e Traefik como serviços
gerenciados pelo Easypanel.
**Motivo:** padrão Raya (decidido em outros projetos). Custo previsível
em BRL, sem lock-in cloud, controle total sobre dados (LGPD argumento de
venda).
**Alternativa rejeitada:** Vercel + Supabase. Mais conveniente mas
incompatível com proposta de soberania de dados.

---

## 10. Pricing (estratégia v0.6+)

### Free (self-host) — sempre grátis

- Funcionalidade idêntica à versão paga, sem limite de contatos.
- Suporte: comunidade (GitHub Issues + Discord).
- Trade-off: você opera a infra, atualiza, faz backup.

### Hosted Free — até 1000 contatos

- 1 conta IG conectada
- Todos os blocos do plano atual
- 1 operador
- Mensagens ilimitadas (rate limit Meta = teto natural)
- Sem AI Step (precisa BYO key)
- Branding "Mushu" no rodapé das mensagens
- Suporte: comunidade

Por que: resgatar exatamente o tier que ManyChat cortou. É o anzol.

### Hosted Pro — R$ 49/mês

- Até 10.000 contatos
- 3 contas IG conectadas
- 3 operadores
- AI Step incluso (BYO key OpenAI/Anthropic)
- Sem branding no rodapé
- Suporte: email com SLA de 24h em dias úteis

### Hosted Agency — R$ 199/mês

- Até 50.000 contatos
- 15 contas IG conectadas
- 10 operadores
- White-label parcial: logo + cor primária custom
- Sub-domínio custom (`bot.suaagencia.com.br`)
- Suporte: email + WhatsApp com SLA 4h em dias úteis
- Onboarding 1:1 inicial

### Wholesale (Raya only) — R$ 8.000-12.000

- Para agências que querem revender automação Instagram como serviço
  próprio
- PRD + MVP 30d + Completa
- Licença comercial Mushu (uso sem AGPL) inclusa
- White-label total (próprio domínio, próprio nome)
- 1 mês de suporte intensivo no fechamento

### Enterprise — cotado

- >50k contatos
- SLA contratual
- Implementação on-prem em VPS do cliente

---

## 11. Riscos e mitigações

### Risco 1 — Meta App Review demorar/recusar

**Probabilidade:** média. **Impacto:** crítico (sem aprovação, só
funciona com tester accounts).

**Mitigação:** abrir o processo de App Review em paralelo ao Bloco 1
do MVP, com submissão completa (vídeo de demo, política de privacidade,
termos de uso, casos de uso documentados) na semana 2. Histórico mostra
1-3 semanas de revisão para apps simples.

### Risco 2 — ManyChat lançar versão grátis em resposta

**Probabilidade:** baixa (eles cortaram pra cobrar mais, não pra
competir). **Impacto:** médio.

**Mitigação:** posicionamento Brasil-first + LGPD + open-source é
defensável mesmo se ManyChat baixar preço. Não somos uma cópia.

### Risco 3 — Rate limit Meta apertar

**Probabilidade:** média. **Impacto:** médio.

**Mitigação:** já desenhamos cliente com retry, backoff, fila por
conta. Se Meta cortar de 200/h para 100/h não quebra.

### Risco 4 — Comunidade OSS não engajar

**Probabilidade:** alta nos primeiros 6 meses. **Impacto:** médio
(reduz velocidade mas não mata).

**Mitigação:** Júlio + Raya operam o repo ativamente nos primeiros 6
meses sem depender de PRs externos. Milestone realista: 100 stars em
6 meses, 3 contribuidores externos consistentes em 12.

### Risco 5 — Júlio fica sem tempo (dependência única)

**Probabilidade:** alta. **Impacto:** crítico.

**Mitigação:** documentação extensiva conforme o código é escrito (não
após). Bruna treina segundo operador para suporte de cliente. Issue
templates + contribuição docs claras para que terceiros possam ajudar
mesmo sem Júlio.

### Risco 6 — LGPD virar problema sério antes de termos política

**Probabilidade:** baixa nos primeiros 12 meses. **Impacto:** alto se
ocorrer.

**Mitigação:** publicar Política de Privacidade + Termos de Uso antes
do lançamento público. Criptografia at rest (já no MVP). DPO terceirizado
contratável quando passar 1.000 workspaces pagantes.

---

## 12. Timeline detalhado (próximos 90 dias)

| Semana | Bloco | Entregáveis principais |
|---|---|---|
| 1 (28/04-04/05) | MVP foundation | Repo público, scaffold, Drizzle schema, webhook handler, OAuth, Better Auth — **feito em 25/04** |
| 2 (05/05-11/05) | MVP engine | Worker processors (event matcher, flow executor, IG client), 24h window, rate limit |
| 3 (12/05-18/05) | MVP UI builder | Flow builder com xyflow, 6 tipos de bloco, save/publish, listagem flows |
| 4 (19/05-25/05) | MVP polish + alpha | Dashboard, contacts list, logs, README final, smoke test E2E, **release v0.1** |
| 5 (26/05-01/06) | Meta App Review | Submeter App Review, gravar demo, escrever política de privacidade |
| 6-8 (junho) | v0.2 dev | Story Reply/Mention, Randomizer, Set Tag/CUF, Condition, Passkey |
| 9-12 (julho) | v0.2 release + Meta approval | Lançar v0.2, finalizar App Review, beta com 5 agências amigas |

---

## 13. Glossário

- **Flow** — automação completa, equivalente ao "Automation" do ManyChat.
- **Trigger** — gatilho que inicia uma execução de flow.
- **Block / Node** — passo individual em um flow.
- **Edge** — conexão entre dois blocos.
- **Execution** — uma rodada de um flow para um contato específico.
- **Workspace / Organization** — espaço isolado por cliente da agência.
- **IGSID** — Instagram-Scoped User ID, identificador que a Meta envia em
  webhooks.
- **HMAC** — Hash-based Message Authentication Code, usado para validar
  assinatura de webhook.
- **Janela de 24h** — restrição da Meta: só pode mandar DM automatizada
  até 24h após última interação do contato.
- **AGPLv3** — Affero General Public License v3, licença OSS que obriga
  publicação de modificações se o software for oferecido como SaaS.
- **MoSCoW** — Must / Should / Could / Won't, framework de priorização.

---

## 14. Histórico de revisões

| Versão | Data | Autor | Mudanças |
|---|---|---|---|
| 0.1 | 2026-04-25 | Claude (com Júlio) | Versão inicial |
