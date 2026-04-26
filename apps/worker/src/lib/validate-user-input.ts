/**
 * Validates a user's reply against an ask_question's expected inputType.
 * Returns the parsed/normalized value when valid, or null when not.
 */
export function validateUserInput(
  raw: string,
  inputType: 'text' | 'email' | 'number' | 'phone',
): string | number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  switch (inputType) {
    case 'text':
      return trimmed;
    case 'email': {
      // Conservative RFC-ish: local@host.tld with no spaces.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
      return trimmed.toLowerCase();
    }
    case 'number': {
      const cleaned = trimmed.replace(/[^\d.\-]/g, '').replace(',', '.');
      const n = Number(cleaned);
      if (!Number.isFinite(n)) return null;
      return n;
    }
    case 'phone': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) return null;
      return digits;
    }
    default:
      return null;
  }
}
