# Mushu: integração, execução e experiência

Auditoria iniciada em 23/09/2026. Este documento distingue código local,
configuração consultada pelo MCP meta-devtools e validação real em produção.
Uma alteração local não significa que a instalação publicada já foi atualizada.

## Retomada em 24/09/2026

- Repositório local em `b95de0d`, sem alterações pendentes no início da sessão.
  O usuário informa web e worker publicados nessa revisão; a revisão dos
  containers ainda não foi reconferida nesta sessão.
- Suite local executada novamente: 177 testes aprovados em 20 arquivos.
- Checagem de tipos aprovada nos quatro pacotes, executada individualmente
  via `corepack pnpm --filter <pacote> typecheck`; o comando raiz via Turbo
  não encontrou o executável `pnpm` no PATH desta sessão.
- Consultas HTTP via curl: `/`, `/login`, `/signup`, `/privacy`, `/terms` e
  `/data-deletion` retornaram 200. `/dashboard`, `/settings/workspace` e início
  OAuth de Instagram/Threads redirecionaram para login (307), sem autenticação.
  O cliente Python recebeu 403; isso não foi reproduzido com curl e não constitui
  evidência de indisponibilidade geral do aplicativo.
- MCP Meta confirmou a assinatura Instagram ativa com `comments`, `messages`,
  `messaging_postbacks`, `messaging_seen`, `messaging_referral` e
  `message_reactions`. Entrega de eventos e assinatura da conta continuam
  pendentes de validação real após reconexão.
- Nenhum navegador conectado; tentativa de abrir navegador integrado retornou
  indisponibilidade. Validação visual/autenticada ainda não executada.
- Acesso à VPS/Easypanel precisa ser identificado nesta sessão. O único alias
  SSH configurado é `hostinger-raya`, documentado como outra hospedagem.
- Solicitada definição dos valores de cobrança. R$197/mês (Pro) e R$597/mês
  (Agency) constam no guia, mas não foram tratados como decisão comercial final.
- Próxima ação operacional: recuperar acesso à produção, reconferir serviços e
  configuração sem expor segredos, reconectar Instagram e validar SMTP/Threads.
  Nenhum deploy ou alteração de configuração em produção nesta retomada.

### Continuação com acesso SSH recuperado

- Acesso confirmado à VPS informada pelo usuário, com a chave existente
  `v3nexus_kvm2` no diretório de credenciais indicado; nenhum segredo copiado
  para este documento. Web/worker estão ativos desde a publicação da madrugada,
  sem estado de reinício ou OOM na inspeção; Postgres e Redis também ativos.
- Banco consultado novamente: 11 migrações; uma conta Instagram, expirada,
  com `webhook_subscribed=false`. Não basta a assinatura ativa do app na Meta.
- SMTP da web: Hostinger, porta 465/TLS, remetente corresponde ao usuário.
  Nova tentativa de autenticação retornou 535, sem envio de mensagem.
  Solicitado caminho local da credencial atualizada.
- Worker não possui `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` nem `EMAIL_FROM`.
  Sua implementação usa essas variáveis para avisos por e-mail; configurar
  após validar a credencial correta, sem propagar a credencial recusada.
- Threads continua sem ID/segredo/redirect configurados. Solicitado caminho
  local das credenciais, caso já existam. Reconexão Instagram solicitada ao
  usuário, pois o navegador permanece indisponível nesta sessão.
- **Cobrança adiada pelo usuário para a tarde**: valores serão reformulados.
  Não alterar preços, catálogo ou configuração Stripe nesta etapa.
- Logs revelaram falha da limpeza diária de `incoming_event`: parâmetro `Date`
  interpolado em SQL bruto sem o encoder da coluna. Correção local usa
  `lt(incomingEvent.createdAt, cutoff)` para serializar o timestamp pelo Drizzle.
  Incluídos quatro testes: serialização do corte de 90 dias, continuação por
  lote, limite de 50 lotes e propagação de erros. Correção ainda não publicada;
  nenhuma limpeza manual de dados executada em produção.

### Recuperação de acesso e conferência do `.env`

- Usuário informou que desativou o Instagram anterior e pretende conectar um
  novo perfil. Não excluir nem reassociar a conta existente automaticamente.
- `.env` local salvo e ignorado pelo Git. Os seis campos SMTP foram comparados
  com o serviço web na VPS e coincidem; teste local Nodemailer também retornou
  `EAUTH / 535`. Ter as variáveis preenchidas não comprova autenticação válida.
- Identificada uma única conta de login, com senha cadastrada e e-mail ainda
  não verificado. Recuperação solicitada pelo endpoint normal do app: HTTP 200,
  token criado, mas envio registrado como falha. Link temporário salvo em
  arquivo local de segredos com permissão 0600, fora do repositório.
- A senha ainda não foi alterada pelo agente. Aguardando o usuário escolher a
  nova senha pelo link, confirmar acesso à caixa cadastrada e atualizar a
  credencial SMTP. Como `MUSHU_MODE=hosted`, a verificação do e-mail continua
  obrigatória; não foi alterado `email_verified` nem desabilitada a exigência.

## 1. Diagnóstico e primeira correção

App Meta: **mushu**, ID `1554434252782653`.

| Área | Evidência | Situação |
| --- | --- | --- |
| Meta | Live, administrador com leitura e gestão, compliance sem violações abertas | Consultado pelo MCP |
| Assinaturas do app | Assinatura Instagram criada pelo MCP e confirmada em nova consulta, ativa com seis campos | Assinatura da conta e entrega real ainda pendentes |
| Permissões | `instagram_business_basic` e `instagram_business_manage_messages` com acesso `none`; `instagram_business_manage_comments` ausente da lista | Alinhar com o fluxo Instagram Login |
| Revisão | `UNSUBMITTED`, histórico vazio; requisitos contraditoriamente mencionam revisão em andamento | Confirmar no painel antes de qualquer submissão |
| Cadastro | Privacidade aponta para `/terms`, termos para outro domínio, exclusão vazia, e-mail não verificado | Corrigir cadastro e verificar contato |
| URLs públicas | HEAD de `/privacy`, `/terms`, `/data-deletion`: HTTP 200 | Disponibilidade confirmada; conteúdo e identidade do operador ainda precisam de revisão |
| Webhook público | GET de verificação com o segredo existente: HTTP 200 e desafio devolvido corretamente | Handshake confirmado; entrega de eventos ainda pendente |
| Ambiente | Easypanel, projeto `saas`, serviços `mushu-web`, `mushu-worker`, `mushu-postgres`, `mushu-redis`; SSH confirmado | Quatro containers ativos; versões e migrações divergentes, conforme auditoria abaixo |

Correções implementadas localmente nesta primeira entrega:

- Remover `messaging_reactions` da assinatura e manter `message_reactions`,
  conforme os campos retornados pela Meta.
- Só aceitar assinatura como concluída quando a resposta trouxer `success: true`.
- Não registrar corpos de erro nem exceções de rede que possam conter tokens
  nas funções de assinatura; o novo tratamento de rede do callback também não
  registra URLs com credenciais.
- Validar o retorno de tokens (direto ou com envelope `data`), duração e perfil;
  rejeitar permissões insuficientes quando a Meta fornece a lista concedida.
- Limitar requisições do callback à Meta a 15 segundos cada e apresentar falhas
  recuperáveis na tela de contas conectadas.
- Usar canal na busca da conta e impedir transferência implícita entre workspaces.
- Limpar o cookie de tentativa nos retornos de resultado do callback.
- Exibir sucesso, erro, assinatura pendente e conexão expirada em português/inglês;
  oferecer reconexão para contas expiradas e permitir quebra das linhas no card.
- Corrigir chaves incompatíveis com Biome 2 na configuração do lint.

A primeira entrega foi apenas local. Na continuação autorizada, foram aplicadas
as migrações pendentes e configurada a assinatura Instagram do app na Meta.
Credenciais existentes foram preservadas.
Não houve envio de mensagens, conexão de conta nem submissão ao App Review.

## 2. Conexão real e ciclo de vida dos tokens

Ordem operacional:

1. Ambiente de produção identificado no Easypanel e acessível por SSH na VPS.
   O alias `hostinger-raya` pertence a outra hospedagem. Antes de publicar,
   alinhar versões e migrações com o estado documentado abaixo.
2. Conferir, sem copiar valores para logs ou documentação:
   `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `META_APP_SECRET`,
   `META_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENCRYPTION_KEY`,
   `NEXT_PUBLIC_APP_URL`, `INSTAGRAM_OAUTH_REDIRECT_URI`, banco e Redis.
   A chave de criptografia existente deve ser preservada: trocá-la exige migrar
   os tokens já armazenados.
3. Conferir **Instagram → API setup with Instagram Login** no painel.
   O ID Instagram é específico do produto; não substituir pelo ID do app Meta.
4. Confirmado o domínio, usar:
   - OAuth: `https://mushu.rayastudio.com.br/api/oauth/instagram/callback`
   - Webhook: `https://mushu.rayastudio.com.br/api/webhooks/instagram`
   - Privacidade: `https://mushu.rayastudio.com.br/privacy`
   - Termos: `https://mushu.rayastudio.com.br/terms`
   - Exclusão: `https://mushu.rayastudio.com.br/data-deletion`
5. Configurar os três escopos usados por `instagram-oauth.ts`:
   `instagram_business_basic`, `instagram_business_manage_messages`,
   `instagram_business_manage_comments`.
6. Confirmar a conta profissional de teste e seu vínculo ao app; realizar OAuth.
7. Validar as duas camadas de assinatura: app/callback e conta conectada.
   A resposta de assinatura da conta não prova entrega de eventos.
8. Com uma interação controlada, acompanhar recebimento → persistência → fila →
   worker → resultado; verificar duplicidade, logs sem segredos e isolamento do workspace.
9. Validar renovação, revogação, reconexão e perda de permissões. Há uma rotina
   horária em `apps/worker/src/processors/refresh-tokens.ts`, ainda não validada
   contra a conta real nesta auditoria. Revisar também o tratamento e os logs dela.

Aceite: conta de teste conecta e uma automação recebe/processa/responde uma vez,
com estado correto na interface e evidência verificável de execução.

### Auditoria da VPS e preparação para atualização

Inspeção em 23/09/2026 (America/Sao_Paulo), sem deploy ou alteração do schema:

- Web publicada em `d80cc0d17085aa36342767a438563dab9aebdbb9`, com deploy
  automático de `main`. Worker em `305b632b5de6ad02e7662ab40a8e2134ca5153d9`,
  com deploy automático desativado. Ambos usam Dockerfiles do repositório.
- Banco registra apenas `0000` a `0005`; os seis hashes correspondem aos SQLs
  locais. Faltam `0006` a `0009` da versão web publicada. O código local também
  inclui `0010`. A coluna `instagram_account.channel` e as tabelas
  `flow_step_event` e `tracked_link` ainda não existem em produção.
- Há uma conta Instagram cadastrada e nenhuma marcada com webhook assinado.
  Tokens e identificação da conta não foram exibidos.
- Variáveis essenciais presentes. Chave de criptografia com formato válido e
  idêntica entre web/worker; URLs de banco e Redis também coincidem. Isso não
  comprova validade dos tokens Meta. `ADMIN_DATABASE_URL` está ausente.
- O MCP não listou agendamentos de backup do Postgres. As consultas de logs
  pelo Easypanel falharam; a leitura pelo Docker não retornou entradas na janela
  consultada. Ausência de logs não comprova funcionamento da integração.
- Backup manual em `/root/mushu-backups/20260924T003153Z/database.dump`, na VPS:
  85.026 bytes, formato custom do PostgreSQL. `pg_restore --list` leu o arquivo
  com sucesso (207 entradas); restauração completa ainda não foi ensaiada.
  SHA-256: `4eafa87fb04cd76b2a9da49ea587d864b51b3dec722d66dea61a7aa8bec7e3a5`.
  O diretório também contém snapshots dos quatro serviços para recuperação.
  Diretório protegido e arquivos com modo `0600`; snapshots contêm segredos e
  devem permanecer na VPS. Esta cópia não substitui um backup externo.

Atualização em 23/09/2026: restauração completa validada em container temporário
com rede desabilitada, sem portas publicadas e armazenamento efêmero. As cinco
migrações pendentes foram ensaiadas com o migrador real; a segunda execução
confirmou idempotência. Os containers temporários foram removidos.

Após novo backup (`before-migrate-004946.dump`), as migrações `0006` a `0010`
foram aplicadas em produção. Conferência: 11 migrações registradas, uma conta
Instagram preservada e as três tabelas novas presentes. Os achados anteriores
representam o estado antes da intervenção.

Próxima sequência: alinhar worker/web e verificar saúde ao publicar o lote local. O worker executa migrações no início: um redeploy já pode modificar
o banco. O push em `main` dispara o deploy web e precisa respeitar essa ordem.

## 3. Navegação e jornadas

Inventário atual:

| Área | Rotas |
| --- | --- |
| Entrada | `/login`, `/signup`, recuperação de senha, convite |
| Operação | `/dashboard`, `/inbox`, `/flows`, `/flows/[id]`, `/triggers` |
| Dados e resultados | `/contacts`, `/analytics`, `/notifications` |
| Conta | `/settings/profile`, `/settings/security`, `/settings/sessions`, `/settings/preferences` |
| Workspace | `/settings/workspace`, `/settings/members`, `/settings/billing` |
| Privacidade e exclusão | `/settings/privacy`, `/settings/danger`, páginas legais públicas |

Jornada prioritária: criar workspace → conectar Instagram → criar fluxo →
configurar gatilho → publicar → conferir resultado/inbox.

Achados iniciais no código do shell (primeiros três já corrigidos localmente):

- Sidebar fixa de 240 px e navegação de configurações de 224 px sem adaptação
  mobile; topbar reserva 288 px para uma busca desabilitada.
- Falta indicação `aria-current` nos links ativos.
- Há um `main` de configurações dentro do `main` do shell.
- Separação entre fluxos e gatilhos precisa ser validada na jornada de publicação.
- O estado de webhook pendente precisa de recuperação operacional: a UI anterior
  sugeria progresso contínuo, e os comentários do código prometiam um retry que
  não existe em `connected-accounts.ts`.
- Auditar permissões de conectar/desconectar para cada papel do workspace,
  inclusive o vínculo entre o workspace de início e retorno do OAuth.

Entrega seguinte: navegação responsiva, caminho claro para integrações e estados
de recuperação. Validar em desktop/mobile, teclado, foco e leitores de tela.

## 4. Design system e layout

Base existente: tokens de cores em `apps/web/src/app/globals.css`, temas claro e
escuro, componentes em `apps/web/src/components/ui`, Radix, Tailwind e variantes
de botões/badges. Preservar a identidade escarlate/âmbar durante a consolidação.

Sequência:

1. Definir funções semânticas para texto, superfície, borda, ação, foco e feedback.
2. Conferir contraste em ambos os temas, especialmente texto secundário/faint e
   feedbacks coloridos; estabelecer escala de tipografia, espaços e raios.
3. Padronizar cabeçalhos, formulários, cards, tabelas, estados vazios, erro e loading.
4. Aplicar primeiro à jornada de integração e primeira automação.
5. Expandir para inbox, contatos, analytics e configurações depois de validar
   o padrão em telas reais. Não declarar revisão visual concluída sem inspeção.

Primeira base implementada localmente: tokens semânticos de ação/foco/link/feedback,
contraste de texto e botões, navegação mobile com Radix, links ativos, salto de
conteúdo e configurações responsivas. Ver `DESIGN_SYSTEM.md`. A busca desabilitada
foi retirada da topbar e o `main` aninhado foi corrigido.

Aceite final ainda pendente: inspeção visual em navegador, comportamento por
teclado em execução e aplicação do padrão nas demais telas. Não há navegador
conectado nesta sessão; a tentativa no navegador integrado também falhou.

## 5. Qualidade e publicação

- Base antes das alterações: 87 testes passaram.
- Primeira correção: 114 testes passaram, incluindo 27 novos casos de OAuth,
  isolamento e assinatura; typecheck web passou. Mais 40 verificações de contraste
  passaram após corrigir o leitor de tokens para tolerar a formatação do CSS.
- Biome dos 28 arquivos de código/configuração alterados passou; parser Tailwind
  habilitado para validar o CSS existente.
- Lint geral, após desbloquear a configuração: 207 erros, 35 avisos e 6 infos
  em 248 arquivos. Resolver o passivo em lote separado; não ocultar regras nem
  fazer reformatação ampla no mesmo lote da conexão.
- Build de produção final (web + worker): passou após as mudanças de navegação
  e tokens visuais, com valores fictícios de CI. Não houve deploy.
- A validação de telas autenticadas e o teste real dependem do ambiente de validação
  e de um navegador conectado. Não foram geradas capturas nem declarada aprovação visual.

## 6. App Review

Depois de estabilizar a experiência:

1. Resolver a inconsistência de status no painel Meta.
2. Manter a solicitação alinhada a Instagram Login; revisar os escopos de Facebook
   presentes na solicitação atual antes de remover ou acrescentar qualquer item.
3. Gravar demonstrações das permissões realmente usadas e concluir pré-testes
   aplicáveis. O MCP indicou vídeos faltantes na solicitação atual.
4. Conferir conta de avaliação, instruções, páginas legais e dados do operador.
5. Submeter o conjunto final e acompanhar o retorno. Live não comprova Advanced Access.

Fontes consultadas pelo MCP:
- [Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login)
- [Webhooks Instagram](https://developers.facebook.com/docs/instagram-platform/webhooks/)
- [Visão geral da plataforma](https://developers.facebook.com/docs/instagram-platform/overview/)

## Pendências funcionais adicionais identificadas

- Renovação de tokens: adicionados timeout, validação do retorno e logs sem
  corpo de resposta ou URL sensível. Falhas transitórias mantêm a assinatura;
  erro explícito de token inválido mantém o fluxo de reconexão. Removido o log
  da URL de Redis no bootstrap. Incluídos 14 testes de regressão.
- Threads: `THREADS_APP_ID` e `THREADS_APP_SECRET` ausentes em produção.
- SMTP: autenticação testada sem envio de e-mail e recusada com código 535
  (EAUTH); corrigir credenciais antes de validar convites e recuperação.
- Stripe: variáveis presentes, ainda sem comprovação ponta a ponta.
- S3: variáveis ausentes; a busca nas ações e bibliotecas consultadas não
  encontrou implementação de upload S3. Não classificar como falha de uma
  função ativa sem identificar primeiro o fluxo que precisaria dela.
- Permissões: adicionada resolução de membro pelo usuário autenticado e workspace
  antes de conectar/desconectar contas e criar, editar, publicar ou excluir fluxos.
  Exclusão de gatilhos também filtra explicitamente o workspace. Novos testes
  verificam bloqueio antes de efeitos externos ou alterações no banco. A auditoria
  completa das demais ações e o teste de papéis na UI continuam pendentes.
- Manutenção de `email_delivery`: dispatcher tem um caso ainda não implementado.
- Teste real depende da identificação dos perfis e autorização para mensagens
  e comentários de teste, solicitadas ao usuário.

Validação do lote com permissões: 177 testes passaram em 20 arquivos; checagem
de tipos passou nos quatro pacotes. Publicação via integração Git do VS Code
(o terminal não herdava inicialmente o helper de autenticação).
