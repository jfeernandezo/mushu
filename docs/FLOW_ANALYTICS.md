# Métricas dos fluxos — v1.0.3

## Ativação

1. Aplique `pnpm db:migrate` com `DATABASE_URL` apontando para o banco da instalação.
2. Configure `APP_URL` no worker com a origem pública HTTPS do app (por exemplo, `https://mushu.example`). Se ausente, usa `NEXT_PUBLIC_APP_URL`; em desenvolvimento o padrão é `http://localhost:3000`.
3. Reinicie web e worker. Abra `/analytics` com uma organização ativa.

A migration `0010_flow_analytics` adiciona `flow_step_event` e `tracked_link`, seus índices e políticas RLS. O endpoint público `/r/{id}` usa a conexão administrativa para resolver somente o token aleatório recebido; não aceita destino ou organização na URL.

## Significado dos números

- Os filtros de 7 e 30 dias selecionam **execuções iniciadas no período**, com janela móvel a partir do horário da consulta. Conclusões, falhas, etapas e cliques se referem a esse mesmo conjunto de execuções.
- Taxa de conclusão = execuções com status `done` / iniciadas. Execuções aguardando resposta, em espera, ativas ou canceladas permanecem no denominador.
- O funil conta execuções que chegaram a cada nó. Ramos são apresentados separadamente; nem toda execução deve passar por todas as etapas. Nós removidos de uma versão publicada continuam aparecendo quando têm eventos no período.
- Há uma linha por `(executionId, nodeId)`, exceto eventos `click`, que podem se repetir. Reprocessar um nó não aumenta a contagem do funil.
- Envios começam como `queued`, tornando-se `ok` após a API confirmar o envio ou `failed` em erros definitivos/retries esgotados. `ok` em pergunta significa que a pergunta foi enviada; em espera significa que a espera foi agendada. Condições registram o handle selecionado, inclusive `follows` e `not_follows`.
- Cliques são acessos GET ao link rastreado, não pessoas únicas. Visitas repetidas e prévias automáticas podem contar; HEAD não conta. O redirecionamento usa HTTP 302 e `Cache-Control: no-store`.
- Execuções anteriores à versão continuam nas contagens gerais, mas suas etapas não são reconstruídas. Botões enviados anteriormente continuam com suas URLs originais e não passam a ser rastreados.
- Excluir um fluxo/execução remove seus eventos e links por cascade. Os links correspondentes passam a retornar 404.

## Validação

- `pnpm test`: testes de execução por etapa, ramos, espera, URLs rastreadas, envio assíncrono, falhas/retries, agregação e redirecionamento.
- `pnpm typecheck`: quatro pacotes pelo Turbo.
- A configuração atual de `biome.json` contém opções incompatíveis com Biome 2 (`files.ignore` e `noConsoleLog`), anteriores a este recorte. Para validar os arquivos alterados, foi usada uma configuração temporária com `files.includes` e `noConsole`, sem alterar a configuração do projeto.
- Todas as migrations foram aplicadas a uma instância temporária PostgreSQL via PGlite; foram verificados deduplicação de etapas, múltiplos cliques, atualização de resultado, RLS com role sem privilégios e cascade.

Ainda é necessário o teste de aceitação na instalação com a conta Instagram de tester: executar um fluxo, clicar no botão e conferir os números em `/analytics`. O ambiente de desenvolvimento desta alteração não tinha Docker nem uma conta Meta conectada para esse teste.
