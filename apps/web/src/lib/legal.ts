// Legal/company identity for the running deployment.
//
// IMPORTANT: every Mushu instance is operated by a *different* legal entity.
// The data below identifies the controller of personal data (LGPD) and the
// service provider in the Terms of Use. NEVER hardcode it — read from env at
// runtime so a fork or fresh deploy doesn't ship someone else's CNPJ.
//
// See SELF_HOSTING.md for the full list of vars to set.

const PLACEHOLDER = '[Configure no .env]';

function envOr(name: string, fallback = PLACEHOLDER): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : fallback;
}

export const COMPANY = {
  legalName: envOr('LEGAL_COMPANY_NAME'),
  tradeName: envOr('LEGAL_COMPANY_TRADE_NAME'),
  cnpj: envOr('LEGAL_COMPANY_CNPJ'),
  address: envOr('LEGAL_COMPANY_ADDRESS'),
  contactEmail: envOr('LEGAL_CONTACT_EMAIL', 'contato@example.com'),
  jurisdiction: envOr('LEGAL_JURISDICTION'),
} as const;

export const APP = {
  name: 'Mushu',
  url: envOr('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  shortDescription:
    'Plataforma de automação de mensagens e comentários do Instagram, alternativa open-source ao ManyChat.',
} as const;

export const LEGAL = {
  effectiveDate: envOr('LEGAL_EFFECTIVE_DATE', '25 de abril de 2026'),
  privacyUrl: `${APP.url}/privacy`,
  termsUrl: `${APP.url}/terms`,
  dataDeletionUrl: `${APP.url}/data-deletion`,
} as const;

// Bump these when the user-facing legal text materially changes. Stored on
// every signup-consent audit_log row so we can later prove which version
// the user accepted (LGPD art. 8 §2). On bump, also surface a "review the
// updated terms" prompt to existing users on next login (TODO).
export const TERMS_VERSION = '2026-04-25';
export const PRIVACY_VERSION = '2026-04-25';
