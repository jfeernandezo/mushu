'use client';

import { Lightbulb, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface TemplateBannerProps {
  flowId: string;
  templateId: string;
}

const STORAGE_KEY_PREFIX = 'mushu_template_banner_dismissed_';

export function TemplateBanner({ flowId, templateId }: TemplateBannerProps) {
  const t = useTranslations('flowBuilder.templateBanner');
  const tTemplates = useTranslations();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${flowId}`);
    if (!dismissed) setVisible(true);
  }, [flowId]);

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${flowId}`, '1');
    }
    setVisible(false);
  }

  if (!visible) return null;

  const templateName = templateNameFor(tTemplates, templateId);

  return (
    <div className="border-b border-[var(--color-mushu-amber)]/30 bg-[var(--color-mushu-amber)]/10 px-6 py-3">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mushu-amber)]" />
        <div className="flex-1 text-xs">
          <p className="mb-1.5 font-medium text-[var(--color-mushu-ink)]">
            {t('title', { template: templateName })}
          </p>
          <ul className="ml-4 list-disc space-y-0.5 text-[var(--color-mushu-mute)]">
            <li>{t('tip1')}</li>
            <li>{t('tip2')}</li>
            <li>{t('tip3')}</li>
            <li>{t('tip4')}</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="rounded-md p-1 text-[var(--color-mushu-mute)] transition-colors hover:bg-[var(--color-mushu-surface-hover)] hover:text-[var(--color-mushu-ink)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function templateNameFor(t: ReturnType<typeof useTranslations>, id: string): string {
  // Maps template ids ('comment-to-dm') to camel keys in messages JSON.
  const camel = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  try {
    return t(`flowTemplates.${camel}.name`);
  } catch {
    return id;
  }
}
