import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
type RGB = [number, number, number];

function rgb(hex: string): RGB {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as RGB;
}

function luminance(color: RGB) {
  const linear = color.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}

function contrast(a: RGB, b: RGB) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

for (const theme of ['dark', 'light']) {
  const block = css.replaceAll('"', "'").split(`[data-theme='${theme}'] {`)[1]?.split('}')[0] ?? '';
  const tokens = Object.fromEntries(
    [...block.matchAll(/--color-mushu-([\w-]+):\s*(#[\da-f]{6});/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  function color(name: string) {
    const hex = tokens[name];
    if (!hex) throw new Error(`Missing ${theme} theme token: ${name}`);
    return rgb(hex);
  }

  describe(`${theme} theme contrast for normal text`, () => {
    for (const surface of ['bg', 'surface', 'surface-hover']) {
      for (const text of ['ink', 'mute', 'faint', 'link']) {
        it(`${text} is legible on ${surface}`, () => {
          expect(contrast(color(text), color(surface))).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    for (const background of ['action', 'action-hover', 'action-danger', 'action-danger-hover']) {
      it(`button labels are legible on ${background}`, () => {
        expect(contrast(color('on-action'), color(background))).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const [text, background] of [
      ['accent-text', 'scarlet'],
      ['success', 'success'],
      ['warning', 'amber'],
      ['danger', 'danger'],
    ]) {
      it(`${text} badge is legible on its tinted surface`, () => {
        const base = color('surface');
        const tinted = color(background ?? '').map(
          (channel, index) => channel * 0.15 + (base[index] ?? 0) * 0.85,
        ) as RGB;
        expect(contrast(color(text ?? ''), tinted)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
