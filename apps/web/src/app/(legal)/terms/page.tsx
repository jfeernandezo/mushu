import type { Metadata } from 'next';
import { APP, COMPANY, LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `Termos de Uso — ${APP.name}`,
  description: `Termos de Uso da plataforma ${APP.name}.`,
};

const h1 = 'mb-6 text-3xl font-semibold tracking-tight';
const h2 = 'mt-12 mb-4 text-xl font-semibold tracking-tight';
const p = 'mb-4 text-sm leading-relaxed text-[var(--color-mushu-mute)]';
const ul = 'mb-4 list-disc space-y-2 pl-6 text-sm leading-relaxed text-[var(--color-mushu-mute)]';
const strong = 'text-[var(--color-mushu-ink)]';
const a = 'text-[var(--color-mushu-amber)] hover:underline';

export default function TermsPage() {
  return (
    <>
      <h1 className={h1}>Termos de Uso</h1>
      <p className={p}>
        Estes Termos de Uso (“<strong className={strong}>Termos</strong>”) regulam o acesso
        e a utilização da plataforma <strong className={strong}>{APP.name}</strong>{' '}
        (“Plataforma”), oferecida por{' '}
        <strong className={strong}>{COMPANY.legalName}</strong> (“nós”, “nosso”), CNPJ{' '}
        {COMPANY.cnpj}, com sede em {COMPANY.address}. Ao criar uma conta ou utilizar a
        Plataforma, você (“Usuário”) declara ter lido, compreendido e concordado com estes
        Termos e com a{' '}
        <a className={a} href="/privacy">
          Política de Privacidade
        </a>
        .
      </p>

      <h2 className={h2}>1. Sobre a Plataforma</h2>
      <p className={p}>
        O {APP.name} é uma ferramenta auto-hospedável de automação de mensagens diretas
        (DMs) e respostas a comentários para contas profissionais do Instagram, com
        integração à Plataforma Meta via Instagram Business Login. A Plataforma é
        disponibilizada como software de código aberto e, em sua versão hospedada, pode ser
        oferecida de forma gratuita ou paga, conforme indicado no momento da contratação.
      </p>

      <h2 className={h2}>2. Cadastro e conta</h2>
      <ul className={ul}>
        <li>
          Para usar a Plataforma você deve ter pelo menos 18 anos e capacidade civil plena
          para celebrar contratos.
        </li>
        <li>
          Você é responsável por fornecer informações verdadeiras, completas e atualizadas, e
          por manter o sigilo das credenciais de acesso. Toda atividade realizada com a sua
          conta é de sua responsabilidade.
        </li>
        <li>
          Reservamo-nos o direito de recusar, suspender ou encerrar contas que violem estes
          Termos, a Política de Privacidade ou as políticas da Meta.
        </li>
      </ul>

      <h2 className={h2}>3. Conexão com o Instagram</h2>
      <p className={p}>
        A funcionalidade central do {APP.name} depende da sua autorização explícita para
        acessar uma conta profissional (Business ou Creator) do Instagram. Ao conectar a sua
        conta:
      </p>
      <ul className={ul}>
        <li>
          Você declara ser o titular legítimo da conta IG conectada ou possuir autorização
          formal do titular para operá-la.
        </li>
        <li>
          Você concorda em cumprir, no uso da Plataforma, as{' '}
          <a className={a} href="https://developers.facebook.com/devpolicy/">
            Políticas para Desenvolvedores da Plataforma Meta
          </a>
          , os{' '}
          <a
            className={a}
            href="https://help.instagram.com/581066165581870/"
          >
            Termos de Uso do Instagram
          </a>{' '}
          e as{' '}
          <a className={a} href="https://www.facebook.com/communitystandards/">
            Diretrizes da Comunidade
          </a>
          .
        </li>
        <li>
          Você pode revogar a autorização a qualquer momento, desconectando a conta nas
          configurações da Plataforma ou removendo o aplicativo Mushu nas configurações da
          sua conta Instagram.
        </li>
      </ul>

      <h2 className={h2}>4. Uso aceitável</h2>
      <p className={p}>Você concorda em não utilizar a Plataforma para:</p>
      <ul className={ul}>
        <li>
          Enviar <strong className={strong}>spam</strong>, mensagens não solicitadas em massa,
          phishing, fraude, esquemas piramidais ou qualquer prática vedada pela Meta;
        </li>
        <li>
          Distribuir conteúdo ilegal, difamatório, discriminatório, sexualmente explícito,
          violento ou que infrinja direitos de terceiros (incluindo direitos autorais e marcas);
        </li>
        <li>
          Burlar limites de taxa, sistemas de detecção de abuso, mecanismos de moderação ou
          medidas técnicas da Meta;
        </li>
        <li>
          Coletar, armazenar ou compartilhar dados de usuários do Instagram além do estritamente
          necessário para a funcionalidade contratada;
        </li>
        <li>
          Fazer engenharia reversa, descompilar ou tentar acessar partes não públicas da
          Plataforma sem autorização;
        </li>
        <li>
          Sub-licenciar, revender ou transferir o acesso à Plataforma a terceiros sem nossa
          autorização escrita.
        </li>
      </ul>
      <p className={p}>
        Violar esta seção pode resultar em suspensão imediata da conta, sem aviso prévio, e
        comunicação às autoridades competentes quando aplicável.
      </p>

      <h2 className={h2}>5. Conteúdo do usuário</h2>
      <p className={p}>
        Os fluxos, mensagens, gatilhos, listas de contatos e demais configurações que você
        cria na Plataforma permanecem de sua titularidade. Você nos concede uma licença
        limitada, não exclusiva e revogável para processar tais conteúdos exclusivamente para
        operar e manter o serviço a seu favor.
      </p>
      <p className={p}>
        Você é o único responsável pelo conteúdo das mensagens que a Plataforma envia em seu
        nome, inclusive perante autoridades de proteção ao consumidor, autoridades de
        proteção de dados e os destinatários das mensagens.
      </p>

      <h2 className={h2}>6. Propriedade intelectual</h2>
      <p className={p}>
        O código-fonte do {APP.name} é distribuído sob a licença open-source indicada no
        repositório oficial do projeto. A marca “Mushu”, o logotipo do dragão e os elementos
        visuais distintivos da Plataforma são de titularidade de{' '}
        <strong className={strong}>{COMPANY.legalName}</strong> e não podem ser usados sem
        autorização escrita.
      </p>

      <h2 className={h2}>7. Disponibilidade e suporte</h2>
      <p className={p}>
        Nos esforçamos para manter a Plataforma disponível 24/7, mas não garantimos
        funcionamento ininterrupto, livre de erros ou de interrupções decorrentes de
        manutenção, falhas de terceiros (Meta, provedor de infraestrutura, operadora de
        internet) ou caso fortuito/força maior. Janelas de manutenção programadas serão
        comunicadas com antecedência razoável quando possível.
      </p>

      <h2 className={h2}>8. Pagamentos (quando aplicável)</h2>
      <p className={p}>
        Eventuais planos pagos, preços, ciclos de cobrança e formas de pagamento serão
        apresentados na contratação. O não pagamento pode resultar em suspensão das
        funcionalidades pagas. Cancelamentos e reembolsos seguem o Código de Defesa do
        Consumidor.
      </p>

      <h2 className={h2}>9. Suspensão e encerramento</h2>
      <ul className={ul}>
        <li>
          Você pode encerrar a conta a qualquer momento, conforme instruções da{' '}
          <a className={a} href="/data-deletion">
            página de Exclusão de Dados
          </a>
          .
        </li>
        <li>
          Podemos suspender ou encerrar o acesso de imediato em caso de violação destes
          Termos, das políticas da Meta, ordem judicial, risco à segurança da Plataforma ou
          de terceiros.
        </li>
        <li>
          Após o encerramento, os dados serão tratados conforme a Política de Privacidade
          (seção “Por quanto tempo armazenamos”).
        </li>
      </ul>

      <h2 className={h2}>10. Isenção de garantias</h2>
      <p className={p}>
        A PLATAFORMA É FORNECIDA <strong className={strong}>“NO ESTADO EM QUE SE ENCONTRA”</strong>{' '}
        (“AS IS”), sem garantias de adequação a propósito específico, ausência de defeitos
        ou resultados. Em particular, não garantimos taxas específicas de entrega de DMs ou
        respostas a comentários, que dependem de algoritmos e limites determinados
        unilateralmente pela Meta.
      </p>

      <h2 className={h2}>11. Limitação de responsabilidade</h2>
      <p className={p}>
        Na máxima extensão permitida pela lei, nossa responsabilidade total perante o
        Usuário, por qualquer causa relacionada à Plataforma, fica limitada ao valor
        efetivamente pago por ele nos 12 (doze) meses anteriores ao evento que originou a
        responsabilidade. Em hipótese alguma respondemos por lucros cessantes, perda de
        oportunidade, danos indiretos ou consequenciais, salvo hipóteses em que a lei não
        admita tal limitação.
      </p>

      <h2 className={h2}>12. Indenização</h2>
      <p className={p}>
        O Usuário concorda em indenizar e isentar{' '}
        <strong className={strong}>{COMPANY.legalName}</strong>, suas afiliadas, sócios,
        empregados e prestadores, de qualquer reclamação, perda ou despesa (incluindo
        honorários advocatícios razoáveis) decorrente de violação destes Termos, da Política
        de Privacidade, das políticas da Meta ou de direitos de terceiros pelo conteúdo
        enviado por meio da Plataforma.
      </p>

      <h2 className={h2}>13. Alterações</h2>
      <p className={p}>
        Podemos alterar estes Termos a qualquer momento. A versão vigente fica disponível em{' '}
        <a className={a} href={LEGAL.termsUrl}>
          {LEGAL.termsUrl}
        </a>
        . Alterações materiais serão comunicadas por e-mail ou aviso na Plataforma com
        antecedência razoável; o uso continuado após a vigência implica aceitação.
      </p>

      <h2 className={h2}>14. Lei aplicável e foro</h2>
      <p className={p}>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o
        foro da {COMPANY.jurisdiction.replace('Comarca de ', 'Comarca de ')} para dirimir
        quaisquer controvérsias, com renúncia a qualquer outro, por mais privilegiado que
        seja, sem prejuízo das competências do consumidor previstas no Código de Defesa do
        Consumidor.
      </p>

      <h2 className={h2}>15. Contato</h2>
      <p className={p}>
        Dúvidas sobre estes Termos:{' '}
        <a className={a} href={`mailto:${COMPANY.contactEmail}`}>
          {COMPANY.contactEmail}
        </a>
        .
      </p>
    </>
  );
}
