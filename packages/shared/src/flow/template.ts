/**
 * Renders a message template by replacing `{{var_name}}` placeholders with
 * values from a context. Used by the worker before sending DMs/comment
 * replies, and (later) by the inspector to preview substitutions.
 *
 * Lookup order: variables (in-flight flow state) first, then customFields
 * (persisted on contact). Unknown placeholders are replaced with an empty
 * string — better than leaking literal `{{x}}` to the end user.
 */
export interface TemplateContext {
  variables?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function renderTemplate(text: string, ctx: TemplateContext): string {
  return text.replace(PLACEHOLDER_RE, (_, name: string) => {
    const fromVars = ctx.variables?.[name];
    if (fromVars !== undefined && fromVars !== null) return String(fromVars);
    const fromFields = ctx.customFields?.[name];
    if (fromFields !== undefined && fromFields !== null) return String(fromFields);
    return '';
  });
}

/** Returns the unique variable names referenced in the template. */
export function extractTemplateVariables(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    if (match[1]) names.add(match[1]);
  }
  return Array.from(names);
}
