# Mushu — Notas operacionais de segurança

Documento operacional. Não substitui a auditoria LGPD/security em [`docs/SELF_HOSTING.md`](SELF_HOSTING.md), que cobre RLS, headers, rate limit, audit log e export. Aqui o foco é **gestão de credenciais e acesso ao deploy**.

---

## Modelo de ameaça atual (Mushu hospedado pela Raya)

**Quem ataca:**

- Operador interno deshonesto (ex: futuro membro da equipe Raya com acesso ao painel) — risco baixo hoje (acesso single-person), cresce conforme equipe expande
- Atacante externo via vazamento de credencial em log/repo/chat — risco moderado se credenciais não forem rotacionadas periodicamente
- Atacante via VPS comprometida (SSH key vazada, escalation por exploit) — risco baixo se VPS estiver bem hardenizada

**O que protegemos:**

- Tokens de Instagram dos clientes (criptografados em repouso com `TOKEN_ENCRYPTION_KEY`)
- Dados de contatos e mensagens dos clientes (RLS apertado)
- Credenciais Stripe (sk_live, webhook secret) — comprometimento permite criar charges falsos
- Better Auth secret — comprometimento permite forjar sessions

---

## Limitação conhecida — Easypanel + build args

O Easypanel passa **todas** as variáveis de ambiente como `--build-arg` ao `docker build`, **independente de quais o Dockerfile declara como `ARG`**. Vars não declaradas são silenciosamente ignoradas pelo build em si, mas aparecem em plaintext no log de build acessível pelo painel.

**Implicação prática:** logs de build do Easypanel contêm credenciais (DATABASE_URL com senha, STRIPE_SECRET_KEY, BETTER_AUTH_SECRET, TOKEN_ENCRYPTION_KEY, SMTP_PASSWORD, META/INSTAGRAM secrets).

**Mitigação aceita** (versus alternativas piores como abandonar Easypanel):

1. Acesso ao Easypanel restrito a operadores autorizados (hoje: só Júlio)
2. 2FA obrigatório na conta Easypanel
3. Rotação completa de credenciais antes de virar pra Stripe live mode (qualquer log antigo de test mode fica obsoleto)
4. Quando equipe Raya crescer (Bruna/Isabella precisarem de acesso): contas Easypanel separadas por pessoa, nunca compartilhar SSH da VPS

**Caminho de fix definitivo** (deferido): refactor do Dockerfile pra usar Docker BuildKit secrets (`--mount=type=secret`) **se e quando** o Easypanel passar a invocar o build com `docker buildx build --secret`. Hoje ele invoca com `--build-arg` e a flag `--secret` não está exposta. Pendente do roadmap do Easypanel.

---

## Checklist pré-live (Stripe `sk_live_`)

Executar **toda** essa lista antes de trocar `MUSHU_MODE` pra hosted com credenciais live. Marcar concluído em ordem.

### 1. Rotação de credenciais

- [ ] **`STRIPE_SECRET_KEY`** — gerar `sk_live_...` no Stripe Dashboard (live mode) → plugar no Easypanel → descartar `sk_test_...` antigo do registro
- [ ] **`STRIPE_WEBHOOK_SECRET`** — criar novo webhook endpoint no Stripe live mode → plugar `whsec_...` novo
- [ ] **`STRIPE_PRICE_ID_PRO`** + **`STRIPE_PRICE_ID_AGENCY`** — recriar produtos em live mode (IDs são diferentes de test)
- [ ] **`BETTER_AUTH_SECRET`** — gerar novo: `openssl rand -base64 32` → plugar → invalida todas as sessions existentes (esperado em pré-live)
- [ ] **`META_APP_SECRET`** + **`INSTAGRAM_APP_SECRET`** — regenerar no painel Meta → plugar
- [ ] **`META_WEBHOOK_VERIFY_TOKEN`** — gerar novo: `openssl rand -hex 16` → plugar no `.env` E reconfigurar no webhook do Meta
- [ ] **`SMTP_PASSWORD`** — trocar senha do mailbox na Hostinger → plugar
- [ ] **`TOKEN_ENCRYPTION_KEY`** — **CUIDADO**: trocar essa quebra todos os tokens IG já criptografados no banco. Só rotacionar antes de ter clientes reais conectados, OU implementar reencryption (não existe hoje). Em pré-live, se ainda não há clientes pagos com IG conectado, rotacionar é seguro.

### 2. Acesso e auditoria

- [ ] 2FA ativado na conta Easypanel
- [ ] 2FA ativado nas contas vinculadas: Stripe, Meta for Developers, Hostinger, GitHub (repo Mushu)
- [ ] SSH key da VPS protegida com passphrase, backup em local seguro
- [ ] Lista atualizada de quem tem acesso a quê (Easypanel users, SSH key authorized_keys, Stripe team members)

### 3. Verificação pós-rotação

- [ ] Smoke test completo do checkout em live mode com cartão real (R$ 1 ou conta interna)
- [ ] Webhook Stripe entrega 200 e sincroniza no banco
- [ ] Email de signup chega da nova caixa SMTP
- [ ] OAuth do Instagram completa com sucesso
- [ ] Audit log registra eventos de billing

---

## Quando suspeitar de vazamento

**Sinais:**

- Log de build do Easypanel acessado por IP/usuário desconhecido
- Charges no Stripe sem origem clara
- Mensagens enviadas pelo Mushu fora dos fluxos esperados
- Sessions ativas no Better Auth de geolocalizações estranhas
- SSH na VPS de IPs novos

**Resposta de incidente (rotação imediata):**

1. Revogar `STRIPE_SECRET_KEY` no Stripe Dashboard → gerar nova → plugar no Easypanel
2. Trocar `BETTER_AUTH_SECRET` → todas sessions caem
3. Trocar `SMTP_PASSWORD` no Hostinger → plugar nova
4. Auditar `audit_log` do Postgres — procurar ações suspeitas
5. Revisar logs do Caddy/Easypanel pra IPs e User-Agents suspeitos
6. Se VPS comprometida: restaurar backup do Postgres + criar nova VPS + revogar SSH key antiga

---

## Práticas correntes (manter sempre)

- Nunca colar credenciais em chat (Slack, WhatsApp, Claude/ChatGPT, Discord) — colar direto no painel
- Nunca commitar `.env` no Git (`.gitignore` já cobre, mas confirmar)
- Backup periódico do Postgres (`pg_dump`) em local separado da VPS principal — ver [VPS_DEPLOY.md seção 14](VPS_DEPLOY.md#14-atualização-próximas-vezes-que-der-git-pull)
- Acompanhar Stripe Radar (anti-fraude built-in) ativo em live mode
- Em caso de dúvida sobre risco, escalar pra rotação preventiva — custo é baixo, benefício alto
