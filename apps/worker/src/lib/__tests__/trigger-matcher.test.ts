import { describe, expect, it } from 'vitest';
import { matchKeywords } from '../trigger-matcher.ts';

/**
 * matchKeywords is the hot path for every webhook — every comment and DM
 * runs through it. Regression here means flows silently stop firing.
 *
 * What we cover:
 *   - 'any' mode short-circuits to true regardless of keyword config
 *   - 'exact' / 'contains' / 'starts_with' against trimmed text
 *   - case insensitivity by default + accent folding (NFD strip)
 *   - case sensitivity opt-in
 *   - empty input / empty keyword list
 */
describe('matchKeywords', () => {
  describe("mode='any'", () => {
    it('matches even with empty keywords', () => {
      expect(matchKeywords('anything goes', [], 'any', false)).toBe(true);
    });
    it('matches even with empty input', () => {
      expect(matchKeywords('', ['x'], 'any', false)).toBe(true);
    });
  });

  describe("mode='exact'", () => {
    it('matches only the exact word (after trim)', () => {
      expect(matchKeywords('  oi  ', ['oi'], 'exact', false)).toBe(true);
      expect(matchKeywords('oi tudo bem', ['oi'], 'exact', false)).toBe(false);
    });
    it('returns false when no keyword matches', () => {
      expect(matchKeywords('tchau', ['oi', 'olá'], 'exact', false)).toBe(false);
    });
  });

  describe("mode='contains'", () => {
    it('matches substring anywhere', () => {
      expect(matchKeywords('quero info por favor', ['info'], 'contains', false)).toBe(true);
    });
    it('matches the first hit when multiple keywords are configured', () => {
      expect(
        matchKeywords('me passa o preço', ['valor', 'preço', 'custo'], 'contains', false),
      ).toBe(true);
    });
  });

  describe("mode='starts_with'", () => {
    it('matches when text begins with keyword', () => {
      expect(matchKeywords('preço por favor', ['preço'], 'starts_with', false)).toBe(true);
    });
    it('does not match when keyword appears mid-string', () => {
      expect(matchKeywords('me diz o preço', ['preço'], 'starts_with', false)).toBe(false);
    });
  });

  describe('case sensitivity', () => {
    it('default (false) folds case', () => {
      expect(matchKeywords('OI', ['oi'], 'exact', false)).toBe(true);
      expect(matchKeywords('Quero INFO', ['info'], 'contains', false)).toBe(true);
    });
    it('caseSensitive=true rejects case-only differences', () => {
      expect(matchKeywords('OI', ['oi'], 'exact', true)).toBe(false);
      expect(matchKeywords('oi', ['OI'], 'exact', true)).toBe(false);
    });
  });

  describe('accent folding (NFD)', () => {
    it('strips diacritics when caseSensitive=false', () => {
      // The user typed "informacao", trigger configured "informação". Should match.
      expect(matchKeywords('informacao', ['informação'], 'contains', false)).toBe(true);
      expect(matchKeywords('informação', ['informacao'], 'contains', false)).toBe(true);
      expect(matchKeywords('promoção', ['promocao'], 'exact', false)).toBe(true);
    });
    it('preserves diacritics when caseSensitive=true', () => {
      expect(matchKeywords('informacao', ['informação'], 'exact', true)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('empty keyword list returns false (modes that read keywords)', () => {
      expect(matchKeywords('hi', [], 'exact', false)).toBe(false);
      expect(matchKeywords('hi', [], 'contains', false)).toBe(false);
      expect(matchKeywords('hi', [], 'starts_with', false)).toBe(false);
    });
    it('whitespace-only input matches when starts_with empty? — it does not', () => {
      // matchKeywords trims input; keyword 'oi' against empty trimmed text fails.
      expect(matchKeywords('   ', ['oi'], 'contains', false)).toBe(false);
    });
  });
});
