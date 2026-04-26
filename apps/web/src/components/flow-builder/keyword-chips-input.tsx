'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, useState } from 'react';
import { expandKeywordVariations } from '@/lib/keyword-variations';

interface KeywordChipsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function KeywordChipsInput({ value, onChange, placeholder }: KeywordChipsInputProps) {
  const t = useTranslations('flowBuilder.keywordsInput');
  const [draft, setDraft] = useState('');

  function commit() {
    const cleaned = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (cleaned.length === 0) return;
    const next = [...value];
    for (const kw of cleaned) {
      if (!next.includes(kw)) next.push(kw);
    }
    onChange(next);
    setDraft('');
  }

  function removeAt(i: number) {
    const next = value.filter((_, idx) => idx !== i);
    onChange(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  }

  const allVariations = value.flatMap((kw) => expandKeywordVariations(kw));
  const uniqueVariations = Array.from(new Set(allVariations));
  const previewLimit = 6;
  const previewShown = uniqueVariations.slice(0, previewLimit);
  const previewRest = uniqueVariations.length - previewLimit;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-2 py-1.5 focus-within:border-[var(--color-mushu-amber)]"
        onClick={(e) => {
          // Click in empty area focuses the input.
          if (e.target === e.currentTarget) {
            (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus();
          }
        }}
      >
        {value.map((kw, i) => (
          <span
            key={`${kw}-${i}`}
            className="inline-flex items-center gap-1 rounded bg-[var(--color-mushu-amber)]/15 px-2 py-0.5 text-xs text-[var(--color-mushu-ink)]"
          >
            {kw}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={t('remove', { keyword: kw })}
              className="text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={value.length === 0 ? (placeholder ?? t('placeholder')) : ''}
          className="min-w-[80px] flex-1 bg-transparent text-xs text-[var(--color-mushu-ink)] outline-none placeholder:text-[var(--color-mushu-faint)]"
        />
      </div>

      {uniqueVariations.length > 0 ? (
        <p className="px-1 text-[10px] leading-relaxed text-[var(--color-mushu-faint)]">
          <span className="font-medium">{t('alsoMatches')}</span>{' '}
          <span>{previewShown.join(', ')}</span>
          {previewRest > 0 ? <span> {t('plusMore', { n: previewRest })}</span> : null}
        </p>
      ) : value.length === 0 ? (
        <p className="px-1 text-[10px] text-[var(--color-mushu-faint)]">{t('hint')}</p>
      ) : null}
    </div>
  );
}
