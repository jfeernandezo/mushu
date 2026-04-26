import type { Metadata } from 'next';
import { APP, COMPANY, LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `Política de Privacidade — ${APP.name}`,
  description: `Política de Privacidade do ${APP.name}, em conformidade com a LGPD e com as exigências da Plataforma Meta para apps Instagram.`,
};

const h1 = 'mb-6 text-3xl font-semibold tracking-tight';
const h2 = 'mt-12 mb-4 text-xl font-semibold tracking-tight';
const h3 = 'mt-8 mb-3 text-base font-semibold';
const p = 'mb-4 text-sm leading-relaxed text-[var(--color-mushu-mute)]';
const ul = 'mb-4 list-disc space-y-2 pl-6 text-sm leading-relaxed text-[var(--color-mushu-mute)]';
const strong = 'text-[var(--color-mushu-ink)]';
const a = 'text-[var(--color-mushu-amber)] hover:underline';

export default function PrivacyPage() {
  return (
    <>
      <h1 className={h1}>Política de Privacidade</h1>
      <p className={p}>
        Esta Política de Privacidade descreve como o <strong className={strong}>{APP.name}</strong> coleta,
        utiliza, armazena, compartilha e protege os dados pessoais de seus usuários, em
        conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)
        e com as políticas da Plataforma Meta aplicáveis a aplicativos que se integram ao
        Instagram.
      </p>

      <h2 className={h2}>1. Quem é o controlador dos seus dados</h2>
      <p className={p}>
        O controlador dos dados pessoais tratados pelo {APP.name} é{' '}
        <strong className={strong}>{COMPANY.legalName}</strong> (nome de fantasia{' '}
        {COMPANY.tradeName}), inscrita no CNPJ sob o nº {COMPANY.cnpj}, com sede em{' '}
        {COMPANY.address}.
      </p>
      <p className={p}>
        Para qualquer assunto relacionado a esta Política, ao tratamento dos seus dados ou
        ao exercício dos seus direitos como titular, entre em contato pelo e-mail{' '}
        <a className={a} href={`mailto:${COMPANY.contactEmail}`}>
          {COMPANY.contactEmail}
        </a>
        .
      </p>

      <h2 className={h2}>2. O que é o {APP.name}</h2>
      <p className={p}>
        O {APP.name} é uma plataforma auto-hospedável e de código aberto que permite a
        empresas, criadores e agências automatizarem respostas a comentários e mensagens
        diretas (DMs) em contas profissionais do Instagram. Para isso, o {APP.name} se
        integra à Plataforma Meta utilizando a API <em>Instagram Business Login</em> e
        endpoints da Graph API do Instagram.
      </p>

      <h2 className={h2}>3. Quais dados coletamos</h2>

      <h3 className={h3}>3.1. Dados de cadastro</h3>
      <ul className={ul}>
        <li>
          <strong className={strong}>Nome</strong>, <strong className={strong}>e-mail</strong> e{' '}
          <strong className={strong}>senha</strong> (a senha é armazenada de forma irreversível,
          via hash criptográfico, e nunca em texto puro).
        </li>
        <li>Identificador da organização (workspace) à qual você pertence.</li>
      </ul>

      <h3 className={h3}>3.2. Dados de sessão e segurança</h3>
      <ul className={ul}>
        <li>Endereço IP, agente de navegador (user-agent) e horários de login.</li>
        <li>
          Tokens de sessão armazenados em cookies HTTP-only, com tempo de expiração definido.
        </li>
      </ul>

      <h3 className={h3}>3.3. Dados do Instagram (após sua autorização explícita)</h3>
      <p className={p}>
        Quando você conecta uma conta profissional do Instagram ao {APP.name} via OAuth,
        recebemos da Meta as seguintes informações, exclusivamente para os escopos que você
        autoriza na tela de consentimento:
      </p>
      <ul className={ul}>
        <li>
          <strong className={strong}>Identificadores da conta Instagram</strong>: ID numérico,
          nome de usuário (username) e tipo da conta.
        </li>
        <li>
          <strong className={strong}>Token de acesso (long-lived)</strong>: armazenado{' '}
          <strong className={strong}>criptografado em repouso</strong> em nossos bancos de dados,
          com chave gerenciada separadamente.
        </li>
        <li>
          <strong className={strong}>Comentários públicos e mensagens diretas</strong> que você
          ou seus seguidores enviam à conta conectada, na medida estritamente necessária para
          que os fluxos de automação configurados por você possam funcionar (por exemplo,
          identificar palavras-chave e responder).
        </li>
        <li>
          <strong className={strong}>Identificadores e nomes de usuários</strong> que
          interagiram com a sua conta conectada (autores de comentários e remetentes de DMs),
          a fim de evitar respostas duplicadas e organizar histórico de conversa.
        </li>
        <li>
          Métricas agregadas de uso da automação (quantidade de comentários respondidos,
          DMs enviadas, fluxos ativos), utilizadas no painel de análise do {APP.name}.
        </li>
      </ul>
      <p className={p}>
        <strong className={strong}>
          Não coletamos sua lista de seguidores, mídias, fotos ou Stories
        </strong>{' '}
        para fins distintos daqueles autorizados pelos escopos solicitados.
      </p>

      <h3 className={h3}>3.4. Dados de uso da plataforma</h3>
      <ul className={ul}>
        <li>
          Logs de aplicação (rotas acessadas, ações executadas, erros), retidos por tempo
          limitado para depuração e segurança.
        </li>
        <li>Configurações dos seus fluxos de automação, gatilhos e contatos importados.</li>
      </ul>

      <h2 className={h2}>4. Para que usamos os seus dados</h2>
      <ul className={ul}>
        <li>
          <strong className={strong}>Operação do serviço</strong>: autenticar você, executar
          os fluxos de automação que você configurou, exibir métricas e histórico.
        </li>
        <li>
          <strong className={strong}>Comunicação</strong>: enviar avisos operacionais essenciais
          (alertas de token expirado, falhas, mudanças contratuais).
        </li>
        <li>
          <strong className={strong}>Segurança e prevenção a fraude</strong>: detectar abusos,
          uso indevido e violações dos Termos de Uso ou das políticas da Meta.
        </li>
        <li>
          <strong className={strong}>Cumprimento de obrigações legais</strong> e atendimento a
          ordens de autoridades competentes.
        </li>
      </ul>
      <p className={p}>
        Os dados do Instagram coletados via Graph API são utilizados{' '}
        <strong className={strong}>
          exclusivamente para entregar a funcionalidade que você ativou
        </strong>{' '}
        — não os vendemos, não os usamos para perfilamento publicitário externo, nem os
        compartilhamos com terceiros que não sejam essenciais à operação do serviço.
      </p>

      <h2 className={h2}>5. Bases legais (LGPD, art. 7º)</h2>
      <ul className={ul}>
        <li>
          <strong className={strong}>Execução de contrato</strong> (art. 7º, V): para criar
          sua conta, autenticar você e operar os fluxos de automação que você contratou.
        </li>
        <li>
          <strong className={strong}>Consentimento</strong> (art. 7º, I): para conectar sua
          conta Instagram e processar dados oriundos da Plataforma Meta. O consentimento é
          coletado na própria tela de autorização do Instagram e pode ser revogado a qualquer
          momento (vide seção 9).
        </li>
        <li>
          <strong className={strong}>Legítimo interesse</strong> (art. 7º, IX): para prevenir
          fraude, abuso e garantir a segurança da plataforma.
        </li>
        <li>
          <strong className={strong}>Cumprimento de obrigação legal</strong> (art. 7º, II):
          quando exigido por lei ou autoridade.
        </li>
      </ul>

      <h2 className={h2}>6. Com quem compartilhamos seus dados</h2>
      <p className={p}>
        Compartilhamos dados pessoais apenas com operadores estritamente necessários para a
        prestação do serviço, e mediante contratos que asseguram padrão de proteção
        equivalente ao desta Política:
      </p>
      <ul className={ul}>
        <li>
          <strong className={strong}>Meta Platforms, Inc.</strong> — para autenticação OAuth e
          envio/recebimento de comentários e DMs via Instagram Graph API. O tratamento desses
          dados pela Meta é regido pelas{' '}
          <a className={a} href="https://www.facebook.com/privacy/policy/">
            políticas da Meta
          </a>
          .
        </li>
        <li>
          <strong className={strong}>Provedor de infraestrutura</strong> (servidores, banco de
          dados, fila de mensagens, armazenamento de objetos): hospedam tecnicamente os dados,
          mas não têm acesso lógico ao seu conteúdo além do necessário para operação.
        </li>
        <li>
          <strong className={strong}>Autoridades públicas e judiciais</strong>, quando exigido
          por lei ou ordem judicial.
        </li>
      </ul>
      <p className={p}>
        Não comercializamos, alugamos nem cedemos dados pessoais a anunciantes, brokers de
        dados ou terceiros para fins de marketing.
      </p>

      <h2 className={h2}>7. Por quanto tempo armazenamos</h2>
      <ul className={ul}>
        <li>
          <strong className={strong}>Dados de cadastro</strong>: enquanto sua conta estiver
          ativa. Após a exclusão, são eliminados em até 30 dias (com exceção de dados retidos
          para cumprir obrigação legal).
        </li>
        <li>
          <strong className={strong}>Tokens do Instagram</strong>: enquanto a conexão estiver
          ativa. Quando você desconectar a conta IG do {APP.name}, o token é apagado
          imediatamente do nosso banco de dados.
        </li>
        <li>
          <strong className={strong}>Mensagens e comentários processados</strong>: até 90 dias
          após o processamento, salvo se você configurar prazo menor nas configurações da
          organização.
        </li>
        <li>
          <strong className={strong}>Logs de aplicação</strong>: até 30 dias.
        </li>
        <li>
          <strong className={strong}>Backups</strong>: até 60 dias após a exclusão dos dados
          ativos, momento em que os backups são rotacionados.
        </li>
      </ul>

      <h2 className={h2}>8. Segurança</h2>
      <p className={p}>
        Adotamos medidas técnicas e organizacionais proporcionais ao risco, incluindo:
        criptografia em trânsito (HTTPS/TLS); criptografia em repouso para tokens de acesso
        do Instagram (AES-256-GCM com chave gerenciada separadamente); controle de acesso
        baseado em organização (workspaces isolados); hashing irreversível de senhas;
        registros de auditoria; e revisão periódica de acessos privilegiados.
      </p>
      <p className={p}>
        Apesar dos esforços, nenhum sistema é absolutamente imune. Caso ocorra um incidente
        de segurança que envolva dados pessoais, comunicaremos a Autoridade Nacional de
        Proteção de Dados (ANPD) e os titulares afetados conforme exigido pela LGPD.
      </p>

      <h2 className={h2}>9. Seus direitos como titular</h2>
      <p className={p}>
        A LGPD garante a você, titular dos dados, os seguintes direitos:
      </p>
      <ul className={ul}>
        <li>Confirmação da existência de tratamento;</li>
        <li>Acesso aos dados;</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>
          Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou
          tratados em desconformidade com a LGPD;
        </li>
        <li>Portabilidade dos dados;</li>
        <li>
          Eliminação dos dados pessoais tratados com base no seu consentimento (vide{' '}
          <a className={a} href="/data-deletion">
            página de Exclusão de Dados
          </a>
          );
        </li>
        <li>Informação sobre compartilhamentos;</li>
        <li>Revogação do consentimento, a qualquer tempo;</li>
        <li>
          Oposição a tratamento realizado com fundamento em uma das hipóteses de dispensa de
          consentimento.
        </li>
      </ul>
      <p className={p}>
        Para exercer qualquer desses direitos, escreva para{' '}
        <a className={a} href={`mailto:${COMPANY.contactEmail}`}>
          {COMPANY.contactEmail}
        </a>
        . Responderemos em até 15 dias.
      </p>

      <h2 className={h2}>10. Cookies</h2>
      <p className={p}>
        Utilizamos cookies estritamente necessários para autenticação (cookie de sessão do
        Better Auth) e para mitigar ataques CSRF durante o fluxo OAuth do Instagram. Não
        utilizamos cookies de terceiros para publicidade ou rastreamento entre sites.
      </p>

      <h2 className={h2}>11. Crianças e adolescentes</h2>
      <p className={p}>
        O {APP.name} não é destinado a menores de 18 anos. Não coletamos intencionalmente
        dados de menores. Caso você tome conhecimento de que um menor nos forneceu dados
        pessoais, entre em contato para que façamos a remoção.
      </p>

      <h2 className={h2}>12. Transferência internacional de dados</h2>
      <p className={p}>
        Parte do tratamento ocorre em servidores localizados fora do território nacional
        (em particular, a Plataforma Meta opera globalmente). Quando isso acontece,
        observamos os requisitos do Capítulo V da LGPD para transferências internacionais.
      </p>

      <h2 className={h2}>13. Alterações nesta Política</h2>
      <p className={p}>
        Podemos atualizar esta Política periodicamente para refletir mudanças legais,
        técnicas ou operacionais. A versão vigente fica sempre disponível em{' '}
        <a className={a} href={LEGAL.privacyUrl}>
          {LEGAL.privacyUrl}
        </a>{' '}
        com indicação da data de vigência. Alterações materiais serão comunicadas por e-mail
        ou aviso destacado no painel.
      </p>

      <h2 className={h2}>14. Contato</h2>
      <p className={p}>
        Encarregado pelo Tratamento de Dados Pessoais (DPO):{' '}
        <a className={a} href={`mailto:${COMPANY.contactEmail}`}>
          {COMPANY.contactEmail}
        </a>
        .
      </p>
      <p className={p}>
        Endereço:{' '}
        <strong className={strong}>{COMPANY.legalName}</strong> — CNPJ {COMPANY.cnpj} —{' '}
        {COMPANY.address}.
      </p>
    </>
  );
}
