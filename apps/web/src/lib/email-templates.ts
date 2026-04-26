import { APP, COMPANY } from './legal';

/**
 * Minimal HTML email templates. Plain inline styles only — half the email
 * clients out there strip <style> blocks and most ignore CSS class selectors.
 *
 * All templates take the URL the user should click as a parameter so the
 * Better Auth hooks can pass through the verified link without us having to
 * reconstruct it. Localised once we have a request-scoped locale — for now
 * we ship pt-BR strings as primary, with a TODO to read user.locale.
 */

const baseStyles = {
  body: 'margin:0;padding:24px 16px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111;',
  card: 'max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;',
  h1: 'font-size:20px;font-weight:600;margin:0 0 16px;color:#111;',
  p: 'font-size:14px;line-height:1.6;margin:0 0 16px;color:#444;',
  button:
    'display:inline-block;background:#c73e1d;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;',
  link: 'color:#c73e1d;word-break:break-all;font-size:12px;',
  footer: 'font-size:11px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:16px;',
};

function shell(opts: { title: string; bodyHtml: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(opts.title)}</title></head>
<body style="${baseStyles.body}">
  <div style="${baseStyles.card}">
    ${opts.bodyHtml}
    <div style="${baseStyles.footer}">
      ${escape(APP.name)} · ${escape(COMPANY.legalName)}<br>
      Você está recebendo este email porque alguém com o seu endereço se cadastrou em ${escape(APP.name)}.
      Se não foi você, pode ignorar — nada acontece sem clicar no link.
    </div>
  </div>
</body></html>`;
}

export function verificationEmail(url: string, name: string | null): {
  subject: string;
  html: string;
} {
  const greeting = name ? `Oi, ${escape(name)} 👋` : 'Bem-vindo ao Mushu 👋';
  return {
    subject: `Confirme seu email no ${APP.name}`,
    html: shell({
      title: 'Confirme seu email',
      bodyHtml: `
        <h1 style="${baseStyles.h1}">${greeting}</h1>
        <p style="${baseStyles.p}">Pra começar a usar o ${escape(APP.name)}, confirme que esse email é seu clicando no botão abaixo:</p>
        <p style="margin:24px 0;"><a href="${url}" style="${baseStyles.button}">Confirmar email</a></p>
        <p style="${baseStyles.p}">Ou copie e cole este link no navegador:</p>
        <p><a href="${url}" style="${baseStyles.link}">${url}</a></p>
        <p style="${baseStyles.p}">O link vale por 24 horas. Se você não criou uma conta, pode ignorar este email.</p>
      `,
    }),
  };
}

export function resetPasswordEmail(url: string, name: string | null): {
  subject: string;
  html: string;
} {
  const greeting = name ? `Oi, ${escape(name)}` : 'Olá';
  return {
    subject: `Redefinir senha no ${APP.name}`,
    html: shell({
      title: 'Redefinir senha',
      bodyHtml: `
        <h1 style="${baseStyles.h1}">${greeting}</h1>
        <p style="${baseStyles.p}">Recebemos um pedido pra redefinir a senha da sua conta. Clique no botão abaixo pra criar uma nova senha:</p>
        <p style="margin:24px 0;"><a href="${url}" style="${baseStyles.button}">Redefinir senha</a></p>
        <p style="${baseStyles.p}">Ou copie e cole este link no navegador:</p>
        <p><a href="${url}" style="${baseStyles.link}">${url}</a></p>
        <p style="${baseStyles.p}">O link vale por 1 hora. Se você não pediu pra redefinir sua senha, pode ignorar — nada vai mudar.</p>
      `,
    }),
  };
}

export function invitationEmail(opts: {
  url: string;
  inviterName: string | null;
  inviterEmail: string;
  organizationName: string;
  role: string;
}): { subject: string; html: string } {
  const inviter = opts.inviterName ?? opts.inviterEmail;
  return {
    subject: `${inviter} convidou você para ${opts.organizationName} no ${APP.name}`,
    html: shell({
      title: `Convite para ${opts.organizationName}`,
      bodyHtml: `
        <h1 style="${baseStyles.h1}">Você foi convidado 🎉</h1>
        <p style="${baseStyles.p}"><strong>${escape(inviter)}</strong> convidou você para entrar no workspace <strong>${escape(opts.organizationName)}</strong> no ${escape(APP.name)} como <strong>${escape(roleLabel(opts.role))}</strong>.</p>
        <p style="margin:24px 0;"><a href="${opts.url}" style="${baseStyles.button}">Aceitar convite</a></p>
        <p style="${baseStyles.p}">Ou copie e cole este link no navegador:</p>
        <p><a href="${opts.url}" style="${baseStyles.link}">${opts.url}</a></p>
        <p style="${baseStyles.p}">Se você não esperava este convite, pode ignorar — só quem clicar entra no workspace.</p>
      `,
    }),
  };
}

function roleLabel(role: string): string {
  switch (role) {
    case 'owner':
      return 'Proprietário';
    case 'admin':
      return 'Admin';
    case 'editor':
      return 'Editor';
    case 'viewer':
      return 'Visualizador';
    default:
      return role;
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
