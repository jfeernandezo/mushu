import type { Metadata } from 'next';
import { APP, COMPANY } from '@/lib/legal';

export const metadata: Metadata = {
  title: `Exclusão de Dados — ${APP.name}`,
  description: `Como solicitar a exclusão dos dados associados à sua conta no ${APP.name}, em conformidade com a LGPD e com as exigências da Plataforma Meta.`,
};

const h1 = 'mb-6 text-3xl font-semibold tracking-tight';
const h2 = 'mt-12 mb-4 text-xl font-semibold tracking-tight';
const h3 = 'mt-8 mb-3 text-base font-semibold';
const p = 'mb-4 text-sm leading-relaxed text-[var(--color-mushu-mute)]';
const ul = 'mb-4 list-disc space-y-2 pl-6 text-sm leading-relaxed text-[var(--color-mushu-mute)]';
const ol = 'mb-4 list-decimal space-y-2 pl-6 text-sm leading-relaxed text-[var(--color-mushu-mute)]';
const strong = 'text-[var(--color-mushu-ink)]';
const a = 'text-[var(--color-mushu-amber)] hover:underline';

export default function DataDeletionPage() {
  return (
    <>
      <h1 className={h1}>Exclusão de dados</h1>
      <p className={p}>
        Esta página descreve como solicitar a exclusão dos dados pessoais associados ao seu
        uso do <strong className={strong}>{APP.name}</strong>, em conformidade com a LGPD
        (art. 18, VI) e com a exigência de “Data Deletion Instructions URL” da Plataforma
        Meta.
      </p>

      <h2 className={h2}>1. Opção rápida — desconectar a conta Instagram</h2>
      <p className={p}>
        Se você quer apenas que o {APP.name} pare de processar dados da sua conta Instagram
        (mantendo, por exemplo, sua conta de usuário no painel), basta desconectar:
      </p>
      <ol className={ol}>
        <li>
          Acesse <strong className={strong}>{APP.url}</strong> e faça login.
        </li>
        <li>
          Vá em <strong className={strong}>Settings</strong> (ou Configurações da organização).
        </li>
        <li>
          Localize a conta Instagram conectada e clique em{' '}
          <strong className={strong}>Desconectar</strong>.
        </li>
      </ol>
      <p className={p}>
        Ao desconectar, o token de acesso armazenado no nosso banco é apagado{' '}
        <strong className={strong}>imediatamente</strong>. Mensagens e comentários
        previamente processados são removidos conforme o cronograma da seção 4 abaixo.
      </p>
      <p className={p}>
        Você também pode revogar a autorização diretamente nas configurações do Instagram,
        em <strong className={strong}>Configurações &rarr; Apps e sites &rarr; Ativos</strong>.
        Ao remover o {APP.name} de lá, a Meta nos notifica e iniciamos o mesmo processo.
      </p>

      <h2 className={h2}>2. Exclusão completa da conta no {APP.name}</h2>
      <p className={p}>
        Para apagar permanentemente sua conta de usuário, sua organização (workspace) e
        todos os dados associados, envie um e-mail para{' '}
        <a className={a} href={`mailto:${COMPANY.contactEmail}?subject=Exclus%C3%A3o%20de%20dados%20-%20${APP.name}`}>
          {COMPANY.contactEmail}
        </a>{' '}
        com:
      </p>
      <ul className={ul}>
        <li>
          Assunto: <em>“Exclusão de dados — {APP.name}”</em>;
        </li>
        <li>
          O <strong className={strong}>e-mail cadastrado</strong> na sua conta {APP.name};
        </li>
        <li>
          (Opcional) o <strong className={strong}>username do Instagram</strong> que estava
          conectado, para acelerar a localização;
        </li>
        <li>Confirmação de que você é o titular da conta e deseja a exclusão.</li>
      </ul>
      <p className={p}>
        Por segurança, podemos pedir a confirmação a partir do mesmo e-mail cadastrado antes
        de executar a exclusão.
      </p>

      <h2 className={h2}>3. Prazo</h2>
      <ul className={ul}>
        <li>
          <strong className={strong}>Confirmação de recebimento</strong>: até 2 dias úteis.
        </li>
        <li>
          <strong className={strong}>Exclusão dos dados ativos</strong>: até 15 dias úteis.
        </li>
        <li>
          <strong className={strong}>Rotação de backups</strong> (eliminação completa,
          inclusive das cópias de contingência): até 60 dias.
        </li>
      </ul>

      <h2 className={h2}>4. O que é apagado</h2>
      <ul className={ul}>
        <li>Sua conta de usuário (nome, e-mail, hash de senha).</li>
        <li>Sessões e cookies de autenticação.</li>
        <li>
          Tokens de acesso do Instagram (criptografados em repouso) e o vínculo com a sua
          conta IG.
        </li>
        <li>Fluxos, gatilhos, contatos e histórico de processamento.</li>
        <li>Métricas individuais associadas à sua organização.</li>
        <li>Logs de aplicação após o ciclo de retenção (até 30 dias).</li>
      </ul>

      <h2 className={h2}>5. O que pode ser retido</h2>
      <p className={p}>
        Podemos manter dados estritamente necessários para cumprir obrigações legais, exercer
        regularmente direitos em processos judiciais ou administrativos, ou proteger contra
        fraude, conforme art. 16 da LGPD. Tais dados ficam isolados, com acesso restrito, e
        são eliminados ao fim do prazo legal pertinente.
      </p>

      <h2 className={h2}>6. Endpoint para a Plataforma Meta</h2>
      <p className={p}>
        Para fins de configuração no painel do app na Meta, esta página em{' '}
        <strong className={strong}>{APP.url}/data-deletion</strong> serve como{' '}
        <strong className={strong}>Data Deletion Instructions URL</strong>. Solicitações
        automatizadas de exclusão recebidas via callback da Meta também são honradas no
        mesmo prazo descrito na seção 3.
      </p>

      <h2 className={h2}>7. Contato</h2>
      <p className={p}>
        Encarregado pelo Tratamento de Dados Pessoais:{' '}
        <a className={a} href={`mailto:${COMPANY.contactEmail}`}>
          {COMPANY.contactEmail}
        </a>
        .
      </p>
      <p className={p}>
        Controlador: <strong className={strong}>{COMPANY.legalName}</strong>, CNPJ{' '}
        {COMPANY.cnpj}, sediada em {COMPANY.address}.
      </p>
    </>
  );
}
