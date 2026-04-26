'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { updateUserPreferences } from '@/actions/preferences';
import { useTheme } from '@/components/theme-provider';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/config';
import { type Theme, THEMES } from '@/lib/theme';

interface PreferencesFormProps {
  initialLocale: Locale;
}

export function PreferencesForm({ initialLocale }: PreferencesFormProps) {
  const t = useTranslations('settings.preferences');
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  const themeLabels: Record<Theme, string> = {
    light: t('themeLight'),
    dark: t('themeDark'),
    system: t('themeSystem'),
  };

  function onChangeTheme(next: Theme) {
    setTheme(next);
    startTransition(async () => {
      const r = await updateUserPreferences({ theme: next });
      if (!r.ok) toast.error(t('couldNotSaveTheme'));
    });
  }

  function onChangeLocale(next: Locale) {
    if (next === initialLocale) return;
    startTransition(async () => {
      const r = await updateUserPreferences({ locale: next });
      if (r.ok) {
        toast.success(t('languageUpdated'));
        router.refresh();
      } else {
        toast.error(t('couldNotSaveLanguage'));
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-mushu-ink)]">{t('themeLabel')}</h2>
          <p className="text-xs text-[var(--color-mushu-faint)]">{t('themeHint')}</p>
        </div>
        <div className="flex gap-2">
          {THEMES.map((value) => (
            <ThemeRadio
              key={value}
              value={value}
              label={themeLabels[value]}
              checked={theme === value}
              onChange={onChangeTheme}
              disabled={pending}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-mushu-ink)]">{t('languageLabel')}</h2>
          <p className="text-xs text-[var(--color-mushu-faint)]">{t('languageHint')}</p>
        </div>
        <div className="flex flex-col gap-2">
          {LOCALES.map((l) => (
            <LocaleRadio
              key={l}
              value={l}
              checked={initialLocale === l}
              onChange={onChangeLocale}
              disabled={pending}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ThemeRadio({
  value,
  label,
  checked,
  onChange,
  disabled,
}: {
  value: Theme;
  label: string;
  checked: boolean;
  onChange: (v: Theme) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(value)}
      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
        checked
          ? 'border-[var(--color-mushu-amber)] bg-[var(--color-mushu-surface)] text-[var(--color-mushu-ink)]'
          : 'border-[var(--color-mushu-border)] text-[var(--color-mushu-mute)] hover:bg-[var(--color-mushu-surface)] hover:text-[var(--color-mushu-ink)]'
      }`}
    >
      {label}
    </button>
  );
}

function LocaleRadio({
  value,
  checked,
  onChange,
  disabled,
}: {
  value: Locale;
  checked: boolean;
  onChange: (v: Locale) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
        checked
          ? 'border-[var(--color-mushu-amber)] bg-[var(--color-mushu-surface)]'
          : 'border-[var(--color-mushu-border)] hover:bg-[var(--color-mushu-surface)]'
      } ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <input
        type="radio"
        name="locale"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="accent-[var(--color-mushu-amber)]"
      />
      <span className="text-[var(--color-mushu-ink)]">{LOCALE_LABELS[value]}</span>
    </label>
  );
}
