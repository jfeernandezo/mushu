# Deploy do Mushu em VPS — Guia operacional

Este guia leva você do **VPS recém-provisionado** ao **Mushu rodando em produção**, com todas as features das fases concluídas:

- Auditoria LGPD/segurança (RLS, headers, rate limit, audit log, data export)
- Permissões granulares + 4 roles (Owner / Admin / Editor / Viewer)
- Planos Stripe (Free / Pro R$97 / Agency R$197) — opcional
- Convites por email + verificação de email + reset de senha (Hostinger SMTP)
- Triggers do flow builder: `comment_keyword`, `dm_keyword`, `first_dm`, story_*
- Bloco `set_tag` totalmente operacional

> **Quando usar este guia**:
> - **Deploy zero**: você acabou de provisionar a VPS e nunca rodou Mushu nela. Siga seções 1–13 em ordem.
> - **Atualização**: você já tem Mushu no ar e fez `git pull` com novos commits. Pule para a seção 14 (Atualização).

Para detalhes de **cada variável de ambiente**, veja [SELF_HOSTING.md](SELF_HOSTING.md). Este guia foca no **passo-a-passo operacional**.

---

## Sumário

1. [Pré-requisitos do VPS](#1-pré-requisitos-do-vps)
2. [Instalação base do servidor](#2-instalação-base-do-servidor)
3. [DNS — apontar os subdomínios](#3-dns--apontar-os-subdomínios)
4. [Clonar o repo + criar `.env`](#4-clonar-o-repo--criar-env)
5. [Hostinger SMTP — criar mailbox + SPF/DKIM](#5-hostinger-smtp--criar-mailbox--spfdkim)
6. [Meta App (Instagram OAuth + Webhook)](#6-meta-app-instagram-oauth--webhook)
7. [Stripe (apenas se `MUSHU_MODE=hosted`)](#7-stripe-apenas-se-mushu_modehosted)
8. [Subir Postgres + Redis + MinIO via Docker](#8-subir-postgres--redis--minio-via-docker)
9. [PostgreSQL — split de roles `mushu_app` / `mushu_admin`](#9-postgresql--split-de-roles-mushu_app--mushu_admin)
10. [Aplicar migrations Drizzle](#10-aplicar-migrations-drizzle)
11. [Build e subir `web` + `worker`](#11-build-e-subir-web--worker)
12. [Caddy reverse proxy com HTTPS automático](#12-caddy-reverse-proxy-com-https-automático)
13. [Smoke tests pós-deploy](#13-smoke-tests-pós-deploy)
14. [Atualização (próximas vezes que der `git pull`)](#14-atualização-próximas-vezes-que-der-git-pull)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Pré-requisitos do VPS

**Specs mínimas recomendadas**:

| Recurso | Mínimo | Confortável |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS ou 24.04 LTS | igual |

**Portas expostas** ao mundo:
- `80` (HTTP — Caddy redireciona pra HTTPS)
- `443` (HTTPS — onde o Caddy serve o app)
- `22` (SSH — restrinja por IP no firewall do provedor se possível)

**NÃO exponha** ao mundo:
- `5432` (Postgres), `6379` (Redis), `9000`/`9001` (MinIO), `3000` (Next.js), `3001` (worker se tiver UI). Tudo isso fica `localhost` only — Caddy faz proxy do `3000`.

---

## 2. Instalação base do servidor

SSH na VPS como `root` ou usuário com `sudo`. Atualize tudo:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw
```

**Firewall (UFW)** — só deixa entrar SSH + HTTP + HTTPS:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Docker + Docker Compose**:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out e login de novo pra o group ter efeito (ou reinicie a SSH session)
docker --version            # confirma instalado
docker compose version      # plugin de compose vem junto
```

**Caddy** (reverse proxy com Let's Encrypt automático):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
caddy version
```

**Node 24 + pnpm** (necessário só pra rodar migrations Drizzle fora do Docker; opcional se você for buildar tudo em containers):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@10.32.1 --activate
pnpm --version
```

---

## 3. DNS — apontar os subdomínios

Decida seu domínio. Exemplo: `app.seudominio.com.br`.

**No painel DNS do seu domínio** (Hostinger / Cloudflare / Registro.br), crie:

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| `A` | `app` | `<IP da VPS>` | 300 |
| `A` | `app` (apex se quiser) | `<IP da VPS>` | 300 |

Se for usar email pelo MESMO domínio (`noreply@seudominio.com.br`), os registros MX/SPF/DKIM da Hostinger já vêm configurados quando você compra o plano de email — **conferir** na seção 5.

**Verifique a propagação** (pode levar até 24h, mas geralmente minutos):

```bash
dig app.seudominio.com.br +short
# deve retornar o IP da VPS
```

---

## 4. Clonar o repo + criar `.env`

```bash
sudo mkdir -p /opt/mushu
sudo chown $USER:$USER /opt/mushu
cd /opt/mushu

git clone https://github.com/jfeernandezo/mushu.git .
git checkout main
```

Copie o template e edite:

```bash
cp .env.example .env
nano .env
```

**Preenchimento mínimo para subir**:

```bash
# --- Mode ---
NODE_ENV=production
MUSHU_MODE=hosted             # 'hosted' se vai vender planos; 'selfhost' caso contrário

# --- Database ---
# Estes vão apontar pra dentro do compose network depois (postgres:5432);
# por ora, deixe localhost — vamos ajustar quando subir o web container.
DATABASE_URL=postgres://mushu_app:CHANGE-ME-STRONG@localhost:5432/mushu
ADMIN_DATABASE_URL=postgres://mushu_admin:CHANGE-ME-STRONG@localhost:5432/mushu
REDIS_URL=redis://localhost:6379

# --- Better Auth ---
# Generate: openssl rand -base64 32
BETTER_AUTH_SECRET=GERE-COM-OPENSSL-RAND-BASE64-32
BETTER_AUTH_URL=https://app.seudominio.com.br

# --- Public URL ---
NEXT_PUBLIC_APP_URL=https://app.seudominio.com.br

# --- Token encryption (IG access tokens at rest) ---
# Generate: openssl rand -hex 32
TOKEN_ENCRYPTION_KEY=GERE-COM-OPENSSL-RAND-HEX-32

# --- Meta / Instagram (vamos preencher na seção 6) ---
META_APP_ID=
META_APP_SECRET=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=GERE-RANDOM
INSTAGRAM_OAUTH_REDIRECT_URI=https://app.seudominio.com.br/api/oauth/instagram/callback

# --- S3 (MinIO local) ---
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=mushu
S3_SECRET_KEY=mushu-secret
S3_BUCKET=mushu-media
S3_REGION=us-east-1

# --- Identidade legal (LGPD) ---
LEGAL_COMPANY_NAME=Sua Empresa LTDA
LEGAL_COMPANY_TRADE_NAME=Sua Marca
LEGAL_COMPANY_CNPJ=00.000.000/0001-00
LEGAL_COMPANY_ADDRESS=Rua Exemplo, 123, São Paulo/SP, 01000-000
LEGAL_CONTACT_EMAIL=dpo@seudominio.com.br
LEGAL_JURISDICTION=Comarca de São Paulo, SP, Brasil
LEGAL_EFFECTIVE_DATE=25 de abril de 2026

# --- SMTP (vamos preencher na seção 5) ---
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=

# --- Stripe (apenas se MUSHU_MODE=hosted; vamos preencher na seção 7) ---
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_AGENCY=
```

Gere os secrets:

```bash
openssl rand -base64 32     # → BETTER_AUTH_SECRET
openssl rand -hex 32        # → TOKEN_ENCRYPTION_KEY
openssl rand -hex 16        # → META_WEBHOOK_VERIFY_TOKEN
```

**Cole no `.env` e salve.** Vamos preencher SMTP, Meta, Stripe e ajustar URLs do Postgres nas próximas seções.

---

## 5. Hostinger SMTP — criar mailbox + SPF/DKIM

### 5.1 Criar a caixa no painel Hostinger

1. Painel Hostinger → **Email → Gerenciar**
2. **Criar caixa de email**: `noreply@seudominio.com.br` (ou outro nome)
3. Defina uma senha forte (>16 chars) — copie pra senha gerador
4. Anote: **endereço completo** + **senha**

### 5.2 Conferir SPF e DKIM no DNS

Hostinger normalmente já configura. Conferir no painel DNS:

| Tipo | Nome | Valor |
|---|---|---|
| `MX` | `@` | `mx1.hostinger.com` (priority 5) e `mx2.hostinger.com` (priority 10) |
| `TXT` (SPF) | `@` | `v=spf1 include:_spf.mail.hostinger.com -all` |
| `TXT` (DKIM) | `hostingermail._domainkey` | (chave pública gerada pela Hostinger) |
| `TXT` (DMARC) | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dpo@seudominio.com.br` |

Sem SPF + DKIM, suas mensagens vão pra **spam** e a Meta pode **rejeitar** o app no review.

### 5.3 Preencher no `.env`

```bash
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@seudominio.com.br
SMTP_PASSWORD=a-senha-que-voce-criou
EMAIL_FROM="Mushu <noreply@seudominio.com.br>"
```

> ⚠ O endereço dentro de `EMAIL_FROM` **deve** ser igual ao `SMTP_USER`, senão Hostinger rejeita por **SPF mismatch**. O nome de exibição (`Mushu`) é livre.

### 5.4 Testar SMTP de fora do Mushu

```bash
# Instale swaks pra teste rápido
sudo apt install -y swaks

swaks --to seu-email-pessoal@exemplo.com \
      --from noreply@seudominio.com.br \
      --server smtp.hostinger.com \
      --port 465 --tls-on-connect \
      --auth-user noreply@seudominio.com.br \
      --auth-password 'sua-senha' \
      --header "Subject: Teste Mushu SMTP" \
      --body "Funciona!"
```

Deve chegar na sua caixa em segundos. Se der erro, **pare aqui e debug** — sem SMTP funcionando, signup hosted não funciona.

---

## 6. Meta App (Instagram OAuth + Webhook)

### 6.1 Criar o app no Meta for Developers

1. <https://developers.facebook.com/apps/> → **Criar app**
2. Caso de uso: **Acessar e gerenciar mensagens e dados do Instagram**
3. **Configurações → Básico**:
   - **Privacy Policy URL**: `https://app.seudominio.com.br/privacy`
   - **Terms of Service URL**: `https://app.seudominio.com.br/terms`
   - **Data Deletion Instructions URL**: `https://app.seudominio.com.br/data-deletion`
   - **Categoria**: Empresa

### 6.2 Adicionar produto Instagram

1. Painel do app → **Adicionar Produto → Instagram → Configurar**
2. Em **API setup with Instagram business login → Configuration**:
   - **Valid OAuth Redirect URIs**: `https://app.seudominio.com.br/api/oauth/instagram/callback`
   - **Webhook URL**: `https://app.seudominio.com.br/api/webhooks/instagram`
   - **Verify Token**: cole o valor que você gerou pra `META_WEBHOOK_VERIFY_TOKEN`
   - **Subscriptions**: marque `comments`, `messages`, `messaging_postbacks` (e `messaging_referrals` se for usar ref URLs)

### 6.3 Coletar IDs e secrets

| Variável | Onde encontrar |
|---|---|
| `META_APP_ID` | Topo do dashboard, ao lado do nome do app |
| `META_APP_SECRET` | Configurações → Básico → "App Secret" (mostrar) |
| `INSTAGRAM_APP_ID` | Instagram → API setup with Instagram login → "Instagram app ID" |
| `INSTAGRAM_APP_SECRET` | Instagram → API setup with Instagram login → "Instagram app secret" |

**Cole os 4 valores no `.env`.**

### 6.4 Modo de desenvolvimento

Enquanto o app não passou pelo App Review, **só usuários adicionados como Tester / Developer / Admin** conseguem conectar. Adicione você mesmo em **Funções → Funções**.

App Review é seção dedicada — veja `docs/META_APP_REVIEW.md` (criado em Sprint C).

---

## 7. Stripe (apenas se `MUSHU_MODE=hosted`)

**Pule esta seção se `MUSHU_MODE=selfhost`** — o app nem importa Stripe nesse caso.

### 7.1 Criar produtos e preços no Dashboard Stripe

1. <https://dashboard.stripe.com/products> → **Adicionar produto**:
   - Nome: `Mushu Pro`
   - Preço: **R$ 97,00 mensal recorrente**, BRL
   - Copie o **Price ID** (formato `price_xxxxx`) → `STRIPE_PRICE_ID_PRO`
2. Repita para `Mushu Agency` a R$ 197,00 → `STRIPE_PRICE_ID_AGENCY`

### 7.2 Webhook endpoint

1. **Developers → Webhooks → Add endpoint**:
   - **URL**: `https://app.seudominio.com.br/api/webhooks/stripe`
   - **Events**: marque
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
2. Após criar, **revele o Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`

### 7.3 Customer Portal

**Settings → Customer portal → Activate** e configure quais coisas o cliente pode fazer (cancelar, trocar plano, atualizar cartão). Mushu manda o usuário pra esse portal quando ele clica "Gerenciar pagamento" em `/settings/billing`.

### 7.4 Coletar a Secret Key

**Developers → API keys → Restricted keys ou Standard secret key** (`sk_live_...` ou `sk_test_...`) → `STRIPE_SECRET_KEY`.

> 💡 Comece em **modo de teste** (`sk_test_`) até validar o fluxo end-to-end. Depois switch pra live.

---

## 8. Subir Postgres + Redis + MinIO via Docker

O `docker-compose.yml` do repo já define os 3. Suba:

```bash
cd /opt/mushu
docker compose up -d postgres redis minio
docker compose ps
# todos devem aparecer (healthy) em 10-20s
```

**Mude as senhas padrão** dos containers em produção. Edite `docker-compose.yml`:

```yaml
postgres:
  environment:
    POSTGRES_USER: mushu_owner
    POSTGRES_PASSWORD: SENHA-FORTE-DO-OWNER     # ← este é o dono do banco
    POSTGRES_DB: mushu

minio:
  environment:
    MINIO_ROOT_USER: mushu
    MINIO_ROOT_PASSWORD: SENHA-FORTE-DO-MINIO
```

Recreate:

```bash
docker compose down
docker compose up -d postgres redis minio
```

Crie o bucket no MinIO (interface web em `http://<IP-DA-VPS>:9001` — login: `mushu` / senha que você setou):

1. Login no console
2. **Buckets → Create bucket**: `mushu-media`
3. (Opcional) restringir acesso público

---

## 9. PostgreSQL — split de roles `mushu_app` / `mushu_admin`

A camada de RLS (migration 0002) só ativa proteção real se a app conectar com role **sem `BYPASSRLS`**. Workers e webhook precisam de role com `BYPASSRLS` (cross-org).

**Conecte como `mushu_owner`** (dono do banco) e crie as duas roles:

```bash
docker exec -it mushu-postgres psql -U mushu_owner -d mushu
```

Cole tudo de uma vez:

```sql
-- App role: NÃO tem BYPASSRLS — RLS aperta de verdade
CREATE ROLE mushu_app LOGIN PASSWORD 'SENHA-FORTE-MUSHU-APP';
GRANT CONNECT ON DATABASE mushu TO mushu_app;
GRANT USAGE ON SCHEMA public TO mushu_app;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO mushu_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mushu_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mushu_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mushu_app;

-- Admin role: TEM BYPASSRLS — pra worker e webhook ingest
CREATE ROLE mushu_admin LOGIN PASSWORD 'SENHA-FORTE-MUSHU-ADMIN' BYPASSRLS;
GRANT CONNECT ON DATABASE mushu TO mushu_admin;
GRANT USAGE ON SCHEMA public TO mushu_admin;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO mushu_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mushu_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mushu_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mushu_admin;

\q
```

**Atualize o `.env` com as URLs corretas**:

```bash
DATABASE_URL=postgres://mushu_app:SENHA-FORTE-MUSHU-APP@postgres:5432/mushu
ADMIN_DATABASE_URL=postgres://mushu_admin:SENHA-FORTE-MUSHU-ADMIN@postgres:5432/mushu
```

> 🔑 Note: dentro do compose network o hostname é `postgres` (nome do service), não `localhost`. Se for rodar `pnpm migrate` da host (fora do container), use `localhost:5432`.

---

## 10. Aplicar migrations Drizzle

As migrations devem rodar como **dono do banco** (o `mushu_owner`), não como `mushu_app`. Owner pode fazer DDL; `mushu_app` não tem permissão pra `CREATE TABLE`.

**Opção A — rodar do host** (mais rápido pra debug):

```bash
cd /opt/mushu
DATABASE_URL=postgres://mushu_owner:SENHA-FORTE-DO-OWNER@localhost:5432/mushu \
  pnpm install --frozen-lockfile
DATABASE_URL=postgres://mushu_owner:SENHA-FORTE-DO-OWNER@localhost:5432/mushu \
  pnpm -C packages/db migrate
```

Você verá:

```
Running migrations...
Migrations complete.
```

**Opção B — rodar dentro de um container temporário**:

```bash
docker compose run --rm \
  -e DATABASE_URL=postgres://mushu_owner:SENHA-FORTE-DO-OWNER@postgres:5432/mushu \
  --build \
  worker pnpm -C packages/db migrate
```

(O `worker` Dockerfile já roda `pnpm migrate` no startup — então o build dele também aplica as migrations automaticamente quando subir na seção 11.)

**O que cada migration faz** (referência):

| Migration | Conteúdo |
|---|---|
| `0000_vengeful_moon_knight` | Schema base (user, session, contact, conversation, flow…) |
| `0001_exotic_quasar` | Tabela `notification` + colunas `locale`/`theme` em `user` |
| `0002_rls_tenant_isolation` | Coluna `organization_id` denormalizada em 4 tabelas + RLS policies |
| `0003_granular_permissions` | 5 tabelas de permissões + 22 perms + 7 grupos seedados |
| `0004_plans_and_subscriptions` | `plan`, `subscription`, `plan_permission_group` + Free auto pra orgs existentes |

---

## 11. Build e subir `web` + `worker`

Edite `docker-compose.yml` e **descomente** os blocos `web` e `worker`:

```yaml
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_APP_URL: https://app.seudominio.com.br
        BETTER_AUTH_URL: https://app.seudominio.com.br
        BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
    container_name: mushu-web
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgres://mushu_app:SENHA-FORTE-MUSHU-APP@postgres:5432/mushu
      ADMIN_DATABASE_URL: postgres://mushu_admin:SENHA-FORTE-MUSHU-ADMIN@postgres:5432/mushu
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    ports:
      - '127.0.0.1:3000:3000'   # localhost only — Caddy proxy

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    container_name: mushu-worker
    restart: unless-stopped
    env_file: .env
    environment:
      # Worker SEMPRE conecta como admin (BYPASSRLS) — processa eventos cross-org
      DATABASE_URL: postgres://mushu_admin:SENHA-FORTE-MUSHU-ADMIN@postgres:5432/mushu
      ADMIN_DATABASE_URL: postgres://mushu_admin:SENHA-FORTE-MUSHU-ADMIN@postgres:5432/mushu
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
```

> ⚠ **Não** faça `ports: - '3000:3000'` (sem `127.0.0.1:`) — isso expõe o Next direto pro mundo, bypassando o Caddy.

Suba (vai buildar — leva 3-8 min na primeira vez):

```bash
docker compose up -d --build web worker
docker compose logs -f web
# Procure por "Ready in XXXms" — Next tá no ar
# Ctrl+C pra sair do log (containers continuam rodando)
```

Em outro terminal, confirme que worker conectou no Redis:

```bash
docker compose logs worker | tail -20
# Deve mostrar "[worker] connected" ou similar
```

**Se houver erro `[mushu] MUSHU_MODE=hosted but the following env vars are missing...`**, é o instrumentation hook protegendo você de subir incompleto. Volte às seções 5/7 e preencha o que faltou.

---

## 12. Caddy reverse proxy com HTTPS automático

Caddy resolve TLS via Let's Encrypt automaticamente — você só precisa apontar o A record (já fez na seção 3) e dar a config certa.

Edite `/etc/caddy/Caddyfile`:

```bash
sudo nano /etc/caddy/Caddyfile
```

```caddy
app.seudominio.com.br {
  reverse_proxy localhost:3000 {
    # Necessário pro rate limiter e audit log verem o IP real do cliente
    header_up X-Forwarded-For {remote_host}
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-Proto {scheme}
    header_up Host {host}
  }

  # Opcional: log de acesso pra debug
  log {
    output file /var/log/caddy/mushu-access.log {
      roll_size 100mb
      roll_keep 7
    }
  }

  # Os security headers já vêm do Next (next.config.ts).
  # Caddy só preserva — nada a fazer aqui.
}
```

Reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Em ~30 segundos Caddy obtém o certificado TLS. Verifique:

```bash
curl -I https://app.seudominio.com.br/
# Espera: HTTP/2 200, com headers Strict-Transport-Security etc.
```

---

## 13. Smoke tests pós-deploy

Rode estes 9 testes em ordem. Se algum falhar, debug antes de avançar.

### 13.1 Página inicial carrega

```bash
curl -sI https://app.seudominio.com.br/ | head -1
# HTTP/2 200
```

Abra no navegador → landing aparece. Em **hosted mode**, hero mostra "Começar grátis" + "Ver planos" + "Self-host".

### 13.2 Security headers presentes

```bash
curl -sI https://app.seudominio.com.br/ \
  | grep -E "Strict-Transport|X-Frame|X-Content|Content-Security|Referrer-Policy"
# Espera: 5 linhas
```

### 13.3 Pricing renderiza (hosted) ou 404 (selfhost)

```bash
curl -sI https://app.seudominio.com.br/pricing | head -1
# hosted: HTTP/2 200
# selfhost: HTTP/2 404
```

### 13.4 RLS está apertando

```bash
docker exec -it mushu-postgres psql -U mushu_app -d mushu -c "SELECT count(*) FROM contact;"
# Espera: count = 0 (sem GUC setado, RLS bloqueia tudo)

docker exec -it mushu-postgres psql -U mushu_owner -d mushu -c "SELECT count(*) FROM contact;"
# Espera: o número real de contatos (owner bypassa RLS)
```

### 13.5 Rate limit em auth funciona

```bash
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://app.seudominio.com.br/api/auth/sign-in/email \
    -H "Content-Type: application/json" \
    -d '{"email":"x@y.com","password":"wrong"}'
done
# Espera: primeiros 10 retornam 401, do 11º em diante retornam 429
```

### 13.6 Signup → email de verificação chega

1. Vá em `https://app.seudominio.com.br/signup`
2. Cadastre-se com seu email pessoal
3. **Confira a inbox** — email "Confirme seu email no Mushu" deve chegar em < 30s
4. Clique no link → redirect pro dashboard logado

Se não chegar: `docker compose logs web | grep email` — provavelmente é credencial SMTP errada.

### 13.7 Convite por email funciona

1. Logado, vá em `/settings/members`
2. Clique **Convidar membro** → digite outro email seu (Gmail por exemplo) com role Editor
3. Email "X convidou você para Y" chega
4. Abra link em janela anônima → faz signup → cai no workspace como Editor

### 13.8 Conexão Instagram funciona (se Meta App liberado)

1. Vá em `/settings/workspace` → **Conectar Instagram**
2. Login Meta → autoriza permissões
3. Volta com badge "Instagram conectado" no dashboard

Se você for tester do Meta App, isso já funciona em modo dev. Senão, precisa passar no App Review.

### 13.9 (Hosted) Stripe checkout funciona

1. Vá em `/pricing` → clique **Pro**
2. Cai no Stripe Checkout
3. Use cartão de teste `4242 4242 4242 4242` (com `MUSHU_MODE=hosted` + `STRIPE_SECRET_KEY=sk_test_...`)
4. Volta pro app → `/settings/billing` mostra "Pro · Ativo"
5. Confira: `docker compose logs web | grep stripe` — deve ter "[stripe webhook] received"

---

## 14. Atualização (próximas vezes que der `git pull`)

A maioria dos updates futuros é **3 comandos**:

```bash
cd /opt/mushu
git pull origin main
docker compose up -d --build web worker
```

**Quando há migration nova** (você verá novos arquivos em `packages/db/drizzle/0005_*.sql`):

```bash
cd /opt/mushu
git pull origin main

# Aplicar migrations PRIMEIRO (como owner)
DATABASE_URL=postgres://mushu_owner:SENHA-DO-OWNER@localhost:5432/mushu \
  pnpm -C packages/db migrate

# Depois rebuild
docker compose up -d --build web worker
```

**Quando há env var nova** (acompanhe o `CHANGELOG.md` do commit; ou `git diff HEAD~1 -- .env.example`):

```bash
nano .env                            # adicione as variáveis novas
docker compose up -d web worker      # restart pra pegar o env
```

**Rollback de emergência**:

```bash
git log --oneline -5                                  # achar o commit estável anterior
git checkout <SHA-DO-COMMIT-ANTERIOR>
docker compose up -d --build web worker
# Migrations NÃO são revertidas automaticamente — se for forward-only, precisa
# de migration de reverse manual ou snapshot do Postgres
```

> 💾 **Backup do Postgres** antes de update grande:
> ```bash
> docker exec mushu-postgres pg_dump -U mushu_owner mushu \
>   | gzip > /opt/mushu/backups/mushu-$(date +%Y%m%d-%H%M).sql.gz
> ```

---

## 15. Troubleshooting

### App sobe mas dá 502 no Caddy

- `docker compose logs web` — Next está rodando?
- `curl http://localhost:3000/` direto na VPS — responde?
- Confirme que o `ports` do `web` é `127.0.0.1:3000:3000` (não `0.0.0.0`).

### Instrumentation crash: `MUSHU_MODE=hosted but ... missing`

Você setou `MUSHU_MODE=hosted` mas faltou alguma var Stripe/SMTP. A mensagem de erro lista exatamente quais. Preencha e `docker compose up -d web worker`.

### Email não chega

```bash
# 1. Testa SMTP fora do Mushu (seção 5.4) — se falhar, é credencial errada
# 2. Confere logs do web
docker compose logs web | grep -i email
# 3. Confere SPF/DKIM no DNS — sem eles, Gmail/Hostinger bloqueiam silencioso
dig TXT seudominio.com.br +short | grep spf
```

### Convite gera link mas email não chega

Mesmo problema acima (SMTP). O link funciona — você pode copiar do banco:

```bash
docker exec -it mushu-postgres psql -U mushu_owner -d mushu \
  -c "SELECT id, email, expires_at FROM invitation WHERE status='pending';"
# Acesse https://app.seudominio.com.br/accept-invitation/<id>
```

### Webhook Meta retorna 401 / `invalid signature`

- `META_APP_SECRET` no `.env` tem que bater com **App Secret** do Meta dashboard
- Se trocou o secret no Meta, atualizou o `.env`? `docker compose up -d web` pra re-ler

### Webhook Stripe retorna 400 / `invalid_signature`

- `STRIPE_WEBHOOK_SECRET` deve ser o `whsec_...` do **endpoint específico** que você criou (cada endpoint tem seu próprio secret)
- Se você está em modo de teste vs live, os endpoints e secrets são separados

### `mushu_app` retorna 0 rows em queries que deveriam ter dados

RLS está funcionando — query precisa ser feita dentro de `withOrgTx(orgId, ...)`. Verifique se a Server Action chamadora wrappa em transação. Se for query direta de debug, use `mushu_owner` ou faça:

```sql
SET app.current_org_id = '<seu-org-id>';
SELECT * FROM contact;
```

### Quero ver o que o worker está processando agora

```bash
docker compose logs -f worker
# ou observar a queue Redis
docker exec -it mushu-redis redis-cli
> XLEN events
> KEYS bull:*
```

### Encerrar tudo limpo (pra reinstalar / migrar VPS)

```bash
cd /opt/mushu
docker compose down                  # stop containers
docker compose down -v               # ⚠ APAGA volumes (postgres, redis, minio)
sudo systemctl stop caddy
```

Backup obrigatório antes do `-v`:

```bash
docker exec mushu-postgres pg_dump -U mushu_owner mushu | gzip > /backup/mushu-final.sql.gz
docker run --rm -v mushu_minio-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio-backup.tar.gz -C /data .
```

---

## Próximos passos (após deploy estável)

- **Sprint B** (planejado em `claude-ontem-acredito-que-quizzical-crayon.md`): Story triggers, Quick replies, mais templates
- **Sprint C**: Ownership transfer + prep do Meta App Review
- **Sprint D**: Inbox UI (humano assume conversa)
- **Backup automatizado**: cron rodando `pg_dump` + upload pra S3 externo (Backblaze B2 é barato)
- **Monitoring**: UptimeRobot ou similar pingando `https://app.seudominio.com.br/` a cada 5 min
- **Logs centralizados**: enviar `docker logs` pro Grafana Loki ou Better Stack
