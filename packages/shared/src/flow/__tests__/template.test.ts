import { describe, expect, it } from 'vitest';
import { extractTemplateVariables, renderTemplate } from '../template.ts';

/**
 * renderTemplate runs on every outbound DM/reply that contains a `{{var}}`
 * placeholder. We assert the lookup precedence (variables > customFields >
 * fallback empty) and that the regex doesn't consume false positives.
 */
describe('renderTemplate', () => {
  it('substitutes a single variable', () => {
    expect(
      renderTemplate('Olá {{nome}}!', { variables: { nome: 'Júlio' } }),
    ).toBe('Olá Júlio!');
  });

  it('substitutes from customFields when variables miss', () => {
    expect(
      renderTemplate('teu email: {{email}}', {
        variables: {},
        customFields: { email: 'a@b.com' },
      }),
    ).toBe('teu email: a@b.com');
  });

  it('prefers variables over customFields when both have the key', () => {
    expect(
      renderTemplate('{{x}}', {
        variables: { x: 'from-vars' },
        customFields: { x: 'from-fields' },
      }),
    ).toBe('from-vars');
  });

  it('replaces unknown placeholders with empty string', () => {
    expect(renderTemplate('hi {{ghost}}!', { variables: {} })).toBe('hi !');
  });

  it('coerces non-string values to string', () => {
    expect(
      renderTemplate('idade: {{idade}}, ativo: {{ativo}}', {
        variables: { idade: 30, ativo: true },
      }),
    ).toBe('idade: 30, ativo: true');
  });

  it('treats null and undefined as missing (falls through to fields)', () => {
    expect(
      renderTemplate('{{x}}', {
        variables: { x: null },
        customFields: { x: 'fallback' },
      }),
    ).toBe('fallback');
  });

  it('tolerates whitespace inside braces', () => {
    expect(
      renderTemplate('hi {{ nome }}!', { variables: { nome: 'A' } }),
    ).toBe('hi A!');
  });

  it('does not match malformed placeholders', () => {
    // Single brace, leading digit, special char — none should be replaced.
    expect(
      renderTemplate('{nome} {{1var}} {{var-name}}', { variables: { nome: 'X' } }),
    ).toBe('{nome} {{1var}} {{var-name}}');
  });

  it('handles multiple occurrences of the same variable', () => {
    expect(
      renderTemplate('{{n}} + {{n}} = ?', { variables: { n: 'um' } }),
    ).toBe('um + um = ?');
  });

  it('returns the original string when no placeholders are present', () => {
    expect(renderTemplate('plain text', { variables: { x: 'unused' } })).toBe('plain text');
  });
});

describe('extractTemplateVariables', () => {
  it('extracts unique variable names', () => {
    expect(extractTemplateVariables('{{a}} and {{b}} and {{a}} again').sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('returns empty array when no placeholders exist', () => {
    expect(extractTemplateVariables('just text')).toEqual([]);
  });

  it('ignores malformed placeholders', () => {
    expect(extractTemplateVariables('{x} {{1bad}} {{good}}')).toEqual(['good']);
  });
});
