# Base visual do Mushu

Este guia documenta a primeira consolidação dos componentes compartilhados.
O tema continua escarlate/âmbar, com claro e escuro. A migração de todas as
telas e a inspeção visual em navegador ainda estão pendentes.

## Tokens

Fonte: `apps/web/src/app/globals.css`.

| Função | Tokens `--color-mushu-*` | Uso |
| --- | --- | --- |
| Superfícies | `bg`, `surface`, `surface-hover` | Página, cards, hover |
| Texto | `ink`, `mute`, `faint` | Principal, secundário, metadados |
| Bordas | `border`, `border-subtle` | Separadores e contornos |
| Ação principal | `action`, `action-hover`, `on-action` | Botão principal |
| Ação destrutiva | `action-danger`, `action-danger-hover`, `on-action` | Confirmações de exclusão/desconexão |
| Feedback | `success`, `danger`, `warning`, `accent-text` | Texto de badges e estados |
| Interação | `focus`, `link` | Foco por teclado e links |
| Identidade | `scarlet`, `scarlet-soft`, `amber`, `amber-soft` | Elementos de marca e fundos decorativos |

Não usar a cor de texto de um alerta como fundo de botão com texto branco.
Esse acoplamento fazia o botão destrutivo perder contraste no tema escuro.
Também não usar automaticamente `amber` para links no tema claro: usar `link`.

A suíte `theme-contrast.test.ts` verifica 40 combinações de texto normal,
botões e badges em ambos os temas, com razão mínima de 4,5:1. Isso não
constitui uma auditoria completa de acessibilidade: layout, foco, zoom,
semântica e conteúdo precisam ser verificados nas telas reais.

## Escala e componentes

- Tipografia: família existente Inter/system; `text-xs` para metadados,
  `text-sm` para controles e texto de interface, `text-2xl` para títulos de página.
- Espaçamento: escala Tailwind de 4 px; preferir 8/12/16 px dentro de grupos
  e 24/32 px entre seções.
- Raios: `rounded-md` (6 px) para controles; `rounded-lg` (8 px) para diálogos;
  `rounded-xl` (12 px) para cards. Valores declarados em `@theme`.
- Usar `Button` e suas variantes; confirmações reutilizam `buttonVariants`.
- Usar `Badge` para estado, sempre acompanhado de texto explícito.
- Inputs, botões, fechamento de diálogo e navegação compartilham o token de foco.
- Estados de integração: conectada, eventos pendentes, expirada e erro de
  autorização têm mensagens distintas. Assinatura aceita não comprova entrega.

## Navegação

- Abaixo de 1024 px: botão de navegação abre um diálogo lateral Radix,
  com contenção/restauração de foco e fechamento por Escape. Fechar ao navegar
  ou ao passar para o breakpoint desktop.
- A partir de 1024 px: sidebar fixa na coluna esquerda, com scroll próprio.
- Links ativos usam `aria-current="page"`.
- Shell oferece salto para `#main-content`; configurações não criam outro
  elemento `main` dentro dele.
- Configurações: abas horizontais com scroll abaixo de 1280 px e coluna lateral
  em telas maiores. Não reduzir a largura do conteúdo para manter duas sidebars
  em telas pequenas.
- A busca desabilitada foi removida da topbar. Reintroduzir somente com uma
  jornada de busca funcional.

## Validação visual pendente

Checar em 360 px, 768 px, 1024 px e 1440 px, nos temas claro e escuro:

1. Login → contas conectadas → primeiro fluxo.
2. Menu abre, fecha por Escape e devolve foco ao botão; navegação fecha o menu.
3. Tab alcança todos os controles e o link de salto funciona.
4. Não há scroll horizontal na página; tabelas/abas têm scroll local quando necessário.
5. Zoom de 200%, nomes longos, muitas contas, traduções EN/PT-BR e estados vazios.
6. Confirmar disposição de inbox, editor de fluxos e dashboards antes de aplicar
   o padrão às demais telas.

Limitação desta sessão: o inventário de navegadores retornou vazio e a tentativa
de abrir o navegador integrado retornou `Browser is not available: iab`.
