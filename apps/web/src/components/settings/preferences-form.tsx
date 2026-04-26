'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateUserPreferences } from '@/actions/preferences';
import { useTheme } from '@/components/theme-provider';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/config';
import { type Theme, THEMES } from '@/lib/theme';

interface PreferencesFormProps {
  initialLocale: Locale;
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function PreferencesForm({ initialLocale }: PreferencesFormProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  function onChangeTheme(next: Theme) {
    setTheme(next);
    startTransition(async () => {
      const r = await updateUserPreferences({ theme: next });
      if (!r.ok) toast.error('Could not save theme preference');
    });
  }

  function onChangeLocale(next: Locale) {
    if (next === initialLocale) return;
    startTransition(async () => {
      const r = await updateUserPreferences({ locale: next });
      if (r.ok) {
        toast.success('Language updated');
        router.refresh();
      } else {
        toast.error('Could not save language preference');
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-mushu-ink)]">Theme</h2>
          <p className="text-xs text-[var(--color-mushu-faint)]">
            "System" follows your operating system preference.
          </p>
        </div>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <ThemeRadio
              key={t}
              value={t}
              checked={theme === t}
              onChange={onChangeTheme}
              disabled={pending}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-mushu-ink)]">Language</h2>
          <p className="text-xs text-[var(--color-mushu-faint)]">
            The interface will reload to apply the new language.
          </p>
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
  checked,
  onChange,
  disabled,
}: {
  value: Theme;
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
      {THEME_LABELS[value]}
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
