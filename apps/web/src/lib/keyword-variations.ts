/**
 * Given a keyword the user typed, returns the case + accent variations the
 * matcher will accept. Used purely for UI display ("Also matches: …") — the
 * actual matching at runtime normalizes both sides via NFD + lowercase, so
 * any of these will match.
 *
 * Does NOT generate plurals — that's left for the user to add manually if
 * they want.
 */
export function expandKeywordVariations(kw: string): string[] {
  const trimmed = kw.trim();
  if (!trimmed) return [];

  const set = new Set<string>();
  set.add(trimmed.toLowerCase());
  set.add(trimmed.toUpperCase());
  set.add(capitalizeFirst(trimmed.toLowerCase()));

  const noAccent = stripAccents(trimmed);
  if (noAccent !== trimmed) {
    set.add(noAccent.toLowerCase());
    set.add(noAccent.toUpperCase());
    set.add(capitalizeFirst(noAccent.toLowerCase()));
  }

  // Drop the canonical form itself — caller already knows about it (it's the
  // chip), we only show "also matches".
  set.delete(trimmed);

  return Array.from(set);
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}
