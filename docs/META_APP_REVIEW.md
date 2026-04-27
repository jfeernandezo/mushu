# Meta App Review — Mushu

Checklist de submissão pra App Review da Meta (Instagram Business Login).
Atualize este arquivo a cada nova solicitação de scope ou mudança de fluxo
que afete o uso da Graph API.

---

## 1. App overview (resumo pro reviewer)

**Nome do app**: Mushu

**Categoria**: Business → Customer Service / Marketing Automation

**Plataformas**: Web (Next.js)

**Modo**: SaaS hosted (multi-tenant) + self-host fork open-source

**Em uma frase**: Mushu permite que contas profissionais do Instagram automatizem respostas a comentários e DMs com fluxos visuais — quando alguém comenta uma palavra-chave em um post ou manda uma DM, o Mushu envia uma resposta privada e/ou marca o contato pra segmentação.

---

## 2. Scopes solicitados

| Scope | Por que precisamos | Onde é usado no código |
|-------|--------------------|------------------------|
| `instagram_business_basic` | Identificar a conta IG conectada (id, username, account_type) e listar mídias do usuário pra que ele possa escolher um post específico no construtor de fluxo. | OAuth callback: `/me?fields=id,username,account_type` em [callback/route.ts:118-120](../apps/web/src/app/api/oauth/instagram/callback/route.ts#L118-L120). Listagem de mídia para o post selector: `/me/media` em [instagram-media.ts:81-87](../apps/web/src/actions/instagram-media.ts#L81-L87). |
| `instagram_business_manage_messages` | Enviar Direct Messages automatizadas em resposta a triggers do fluxo (comentário com palavra-chave, primeira DM, story reply, etc.). Sem isso, a feature principal não funciona. | `POST /me/messages` em [instagram-client.ts](../apps/worker/src/lib/instagram-client.ts) (`sendDmByIgsid`, `sendDmByCommentId`). Toda saída de DM passa por aqui. |
| `instagram_business_manage_comments` | Responder publicamente ao comentário que disparou o fluxo (`action.reply_comment` node). Necessário pra fechar o loop quando o usuário usa o template "responder + enviar DM". | `POST /{commentId}/replies` em [instagram-client.ts](../apps/worker/src/lib/instagram-client.ts) (`replyComment`). |

**Scopes que NÃO solicitamos** (mesmo se a documentação Meta os ofereça):

- `instagram_business_content_publish` — não publicamos conteúdo em nome do usuário, só respondemos.
- `instagram_business_manage_insights` — não temos analytics na fase de submissão; quando tivermos, voltaremos pra App Review pra adicionar.
- `pages_*` / `business_management` — Mushu não toca em assets de Page nem de Business Manager.

> **Princípio**: solicitamos o mínimo necessário pra o caso de uso atual. Cada novo scope passa por re-submissão.

---

## 3. Webhook subscriptions

Configurado no App Dashboard → Webhooks → Instagram. Endpoint:
`https://<dominio>/api/webhooks/instagram`

| Field | Por que assinamos | Handler |
|-------|-------------------|---------|
| `comments` | Disparar fluxos quando alguém comenta um post (trigger `comment_keyword`). | [route.ts:69-78](../apps/web/src/app/api/webhooks/instagram/route.ts#L69-L78) (extract from `entry.changes[].field === 'comments'`) |
| `messages` | Disparar fluxos quando alguém manda DM (trigger `dm_keyword`, `first_dm`). | [route.ts:81-93](../apps/web/src/app/api/webhooks/instagram/route.ts#L81-L93) (extract from `entry.messaging[]`, classify story_reply / story_mention via [classifyMessagingType](../apps/web/src/app/api/webhooks/instagram/route.ts#L100-L131)) |
| `messaging_postbacks` | Capturar cliques em quick-reply buttons que o Mushu enviou — Meta entrega o título do botão como se fosse uma DM, então o handler de `messages` cobre isso. | mesmo handler |
| `messaging_seen` (opcional) | Marcar leitura — não usado ainda, mas inscrito pra futura inbox UI. | persistido em `incoming_event` mas não enfileirado — [route.ts:130-131](../apps/web/src/app/api/webhooks/instagram/route.ts#L130-L131) |

**HMAC verification**: toda chamada POST é validada via `verifyMetaSignature` ([route.ts:48-50](../apps/web/src/app/api/webhooks/instagram/route.ts#L48-L50)) com `META_APP_SECRET`. Eventos sem assinatura ou com assinatura inválida são rejeitados com 401.

---

## 4. Roteiro do vídeo demo

Vídeo é OBRIGATÓRIO. Grave 90-120 segundos, 1080p, sem áudio narrado (legendar a tela é suficiente). Use uma conta de teste limpa.

### Cenas

1. **(0:00–0:10) Tela inicial Mushu**
   - Mostre `https://<dominio>/` (landing)
   - Texto na tela: "Mushu — automação de respostas para Instagram Business"

2. **(0:10–0:25) Signup e verificação de email**
   - Clique em "Criar conta", preencha email + nome + senha
   - Mostre o email de verificação chegando (caixa de entrada lateral)
   - Clique no link, mostre o redirect logado

3. **(0:25–0:45) Conectar conta Instagram (OAuth)**
   - Vá em Settings → Workspace
   - Clique em "Conectar Instagram"
   - Tela de autorização Meta aparece — aceite
   - De volta no app, conta listada com badge "Active"

4. **(0:45–1:05) Construir fluxo via template**
   - "Novo fluxo" → escolha template "Boas-vindas no primeiro DM"
   - Mostre o canvas com 3 etapas (trigger first_dm → set_tag → send_dm)
   - Edite a mensagem do `send_dm` ("Olá! Bem-vindo(a)…")
   - Clique em "Publicar"

5. **(1:05–1:30) Recebimento real**
   - Use uma SEGUNDA conta IG pra mandar DM pro perfil de teste
   - Mostre Meta entregando webhook → worker processando → DM de boas-vindas chegando no celular da segunda conta
   - **Importante**: filme ambas as telas (uma no celular, outra no monitor). Use OBS com 2 sources.

6. **(1:30–1:50) Inbox / pause-on-human**
   - Vá em `/inbox` (se já estiver pronto), abra a conversa
   - Mostre o botão "Assumir manualmente"
   - Após enviar uma mensagem manual, mostre o badge "Automação pausada"

7. **(1:50–2:00) Privacidade / data deletion**
   - Vá em Settings → Danger zone
   - Mostre "Excluir minha conta" + diálogo de confirmação (não execute)
   - Mostre `/data-deletion` em outra aba

### Roteiro alternativo (curto, ~60s)

Se preferir vídeo curto: corte cenas 6 e 7. Foque no loop completo de OAuth → criar fluxo → receber DM real → resposta automática.

---

## 5. Test users

A Meta exige test users pra que o reviewer possa logar e testar. Configure no
App Dashboard → Roles → Roles → "Add Instagram Testers".

**Adicione antes da submissão**:

1. Tester 1 (interno do time Mushu): conta pessoal IG do desenvolvedor que vai
   acompanhar a review.
2. Tester 2 (conta dedicada à review): crie uma conta IG nova SEM follow de
   ninguém da equipe, marque como tester. O reviewer vai usar essa conta.

**Credenciais pra incluir no formulário de submissão**:

```
Login do app (não da Meta):
  URL: https://<dominio>/login
  Email: review+meta@<dominio>
  Senha: <gerar 16 chars random — guarde no 1Password>

Conta Instagram conectada à conta de review:
  Username: @mushu_review_tester
  Senha do IG: <gerada pelo time, NÃO usar conta pessoal>
```

> ⚠️ Nunca use credenciais de uma conta pessoal real no formulário de App
> Review. Crie contas dedicadas pra review e descarte/rotacione após.

---

## 6. Privacy Policy review

Antes da submissão, verifique a [Política de Privacidade](../apps/web/src/app/(legal)/privacy/page.tsx) lista TODOS os dados que o app realmente coleta. Discrepância entre o declarado e o implementado é **a causa #1 de rejeição**.

Auditoria atual (✅ = está coberto na privacy page; ❌ = falta cobrir):

| Dado coletado | De onde vem | Onde é armazenado | Coberto na privacy? |
|---|---|---|---|
| Email do usuário | Signup | `user.email` | ✅ |
| Nome do usuário | Signup | `user.name` | ✅ |
| Hash de senha | Signup | `account.password` (Better Auth) | ✅ |
| IP + user-agent (sessões) | Headers HTTP | `session.ip_address`, `session.user_agent` | ✅ |
| IP + user-agent (audit log) | Headers HTTP | `audit_log.ip_address`, `audit_log.user_agent` | ✅ |
| `igUserId` da conta IG conectada | Graph API `/me` | `instagram_account.ig_user_id` | ✅ |
| `igUsername` da conta IG conectada | Graph API `/me` | `instagram_account.ig_username` | ✅ |
| Long-lived access token | Graph API `/access_token` | `instagram_account.access_token_encrypted` (AES-256-GCM) | ✅ |
| Mídias listadas (id + caption + media_url + thumbnail) | Graph API `/me/media` | NÃO armazenado — fetched on-demand pro selector de post | ✅ (declarar como "tratado em memória apenas") |
| `igsid` de contatos que interagem | Webhook payload | `contact_inbox.source_id` | ✅ |
| `username` de contatos que interagem | Webhook payload (campo opcional `from.username`) | `contact_inbox.ig_username` | ✅ |
| Conteúdo de comentários e DMs | Webhook payload | `incoming_event.payload` (raw, sweeper diário deleta após 90 dias — ver [`apps/worker/src/processors/sweep-events.ts`](../apps/worker/src/processors/sweep-events.ts)) + `message.content` (texto extraído) | ✅ |
| Custom fields capturados via `ask_question` | Reply do contato | `contact.custom_fields` (jsonb) | ✅ |
| Tags atribuídas pelo fluxo | Definido pelo cliente Mushu | `contact_tag.tag` | ✅ |

### Checks LGPD/Meta antes de submeter

- [ ] Privacy URL retorna 200 sem login (`https://<dominio>/privacy`)
- [ ] Terms URL retorna 200 sem login (`https://<dominio>/terms`)
- [ ] Data Deletion URL retorna 200 sem login (`https://<dominio>/data-deletion`)
- [ ] Privacy menciona explicitamente o uso da plataforma Meta + scopes solicitados
- [ ] Privacy lista contato (email + CNPJ) do controlador de dados
- [ ] Política de retenção de dados está alinhada (atual: webhooks raw 90 dias, contas excluídas removem dados imediatamente — ver `data_export.ts` e `delete-account-dialog`)
- [ ] User-facing data deletion está implementada e funciona (Settings → Danger → Delete account)
- [ ] Settings → Privacy oferece export LGPD (portabilidade)

---

## 7. Submission form (campo a campo)

### App Review → Permissions and Features

#### `instagram_business_basic`

> **How will your app use this permission/feature?**
>
> Mushu uses `instagram_business_basic` for two purposes:
>
> 1. After a user authorizes our app via Instagram Business Login, we call
>    `GET /me?fields=id,username,account_type` to identify which IG account
>    they connected. We store the id and username so the user can see which
>    account is linked in the workspace settings.
> 2. We call `GET /me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp`
>    to populate a "post selector" dropdown in the flow builder. When a user
>    creates a comment-keyword automation, they pick which specific post the
>    automation should listen to. We do NOT store media data — it's fetched
>    on demand and rendered in the UI only.

#### `instagram_business_manage_messages`

> Mushu's primary purpose is sending automated Direct Messages on behalf of
> the connected Instagram Business account. We call `POST /me/messages` with
> the recipient's `igsid` (or `comment_id` when starting a thread from a
> comment) to deliver replies generated by user-authored automation flows.
>
> Examples:
> - User comments "info" on the connected account's post → Mushu sends a DM
>   with product details (using `recipient.comment_id` since this is the
>   first reply in the thread).
> - User DMs the account for the first time → Mushu sends a welcome message
>   tagged with the contact as "new lead".
> - User sliding-up replies to a story → Mushu sends a thank-you message.
>
> All sends are gated by Meta's 24-hour messaging window — we refuse to
> send if `conversation.lastIncomingAt` is older than 24h and there's no
> open comment context. See [send-message.ts:117-126](../apps/worker/src/processors/send-message.ts#L117-L126) for the window check.

#### `instagram_business_manage_comments`

> Mushu uses `instagram_business_manage_comments` to publicly reply to the
> comment that triggered an automation. This is implemented as the
> `action.reply_comment` block in the flow builder. Example: user comments
> "info" on a post → Mushu replies publicly "Sent you a DM with details!"
> AND sends the actual details via DM.
>
> Implementation: `POST /{commentId}/replies` with the comment text. See
> [instagram-client.ts:121](../apps/worker/src/lib/instagram-client.ts#L121).

---

## 8. Após aprovação

Quando o app for aprovado:

1. Remova `app_in_dev_mode` warnings de qualquer cópia da landing/docs.
2. Atualize o status no README e em `docs/SELF_HOSTING.md` mencionando que
   o app pode rodar em produção pública.
3. Habilite signup público (remover qualquer beta-gate / waitlist gate).
4. Inicie a coleta de métricas Meta-required (DAU, MAU) — necessária pra
   manter elegibilidade da Advanced Access.
5. Rotacione `META_APP_SECRET` se estava usando o mesmo segredo da fase
   de dev (não obrigatório mas higiene).

---

## 9. Defer indefinido (escopo fora desta submissão)

Estes itens NÃO entram nesta App Review. Defer pra revisões futuras pra
manter a submissão atual tight:

- **AI block** (`feature.ai_step`) — Meta vê AI auto-replies como vetor de
  spam. Implementar e submeter separadamente quando tivermos volume real
  e use case bem documentado.
- **Broadcast / mass messaging** — `instagram_business_manage_messages` não
  cobre broadcasts não-solicitados. Se formos implementar, será com Message
  Tags (`HUMAN_AGENT`, `POST_PURCHASE_UPDATE`, etc.) e re-submissão.
- **Insights / Analytics** — `instagram_business_manage_insights` será
  solicitado quando tivermos UI de analytics pronta.
- **Story replies via Stories API** — atualmente recebemos via webhook
  (DM com `reply_to.story`). Não solicitamos a Stories API porque não
  publicamos stories nem leitura de stories arquivados.
