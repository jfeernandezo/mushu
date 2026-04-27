'use client';

import { Check, Circle, Instagram, Mail, Send, Sparkles, Workflow, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { type OnboardingState, dismissOnboarding } from '@/actions/onboarding';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OnboardingChecklistProps {
  state: OnboardingState;
}

interface Item {
  key: 'verifyEmail' | 'connectIg' | 'createFlow' | 'publishFlow' | 'receiveEvent';
  done: boolean;
  href: string | null;
  icon: LucideIcon;
}

/**
 * Post-signup checklist shown above the dashboard. Auto-hides when all five
 * items are ✅ — but the user can also dismiss permanently (persisted in
 * `user.additional_attributes.onboardingDismissed`).
 *
 * The component is a client component because dismiss is interactive AND
 * because we want optimistic visibility toggle. State comes from the server
 * via props, so the polling/refresh story stays simple.
 */
export function OnboardingChecklist({ state }: OnboardingChecklistProps) {
  const t = useTranslations('dashboard.onboarding');
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  // Auto-hide rules: dismissed, all complete, OR optimistic local hide.
  if (
    hidden ||
    state.dismissed ||
    state.completedCount === state.totalCount
  ) {
    return null;
  }

  const items: Item[] = [
    {
      key: 'verifyEmail',
      done: state.hasVerifiedEmail,
      href: null,
      icon: Mail,
    },
    {
      key: 'connectIg',
      done: state.hasIgAccount,
      href: '/api/oauth/instagram/start',
      icon: Instagram,
    },
    {
      key: 'createFlow',
      done: state.hasFlow,
      href: '/flows',
      icon: Workflow,
    },
    {
      key: 'publishFlow',
      done: state.hasPublishedFlow,
      href: '/flows',
      icon: Send,
    },
    {
      key: 'receiveEvent',
      done: state.hasReceivedEvent,
      href: null,
      icon: Sparkles,
    },
  ];

  function onDismiss() {
    setHidden(true);
    startTransition(() => {
      void dismissOnboarding();
    });
  }

  return (
    <Card className="border-[var(--color-mushu-amber)]/30">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[var(--color-mushu-ink)]">{t('title')}</h2>
            <p className="text-xs text-[var(--color-mushu-mute)]">
              {t('progress', { done: state.completedCount, total: state.totalCount })}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('dismissAria')}
            className="text-[var(--color-mushu-faint)] transition-colors hover:text-[var(--color-mushu-mute)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-1 overflow-hidden rounded-full bg-[var(--color-mushu-surface)]">
          <div
            className="h-full bg-[var(--color-mushu-amber)] transition-all duration-300"
            style={{ width: `${(state.completedCount / state.totalCount) * 100}%` }}
          />
        </div>

        <ol className="flex flex-col gap-1.5">
          {items.map((item, idx) => (
            <ChecklistRow key={item.key} item={item} index={idx + 1} />
          ))}
        </ol>

        <button
          type="button"
          onClick={onDismiss}
          className="self-start text-[10px] text-[var(--color-mushu-faint)] underline-offset-2 hover:underline"
        >
          {t('dismissForever')}
        </button>
      </CardContent>
    </Card>
  );
}

function ChecklistRow({ item, index }: { item: Item; index: number }) {
  const t = useTranslations('dashboard.onboarding.items');
  const Icon = item.icon;
  const label = t(`${item.key}.label`);
  const why = t(`${item.key}.why`);

  const inner = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors',
        item.href && !item.done
          ? 'cursor-pointer hover:bg-[var(--color-mushu-surface)]/60'
          : '',
      )}
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
          item.done
            ? 'border-[var(--color-mushu-success)] bg-[var(--color-mushu-success)]/15 text-[var(--color-mushu-success)]'
            : 'border-[var(--color-mushu-border)] text-[var(--color-mushu-faint)]',
        )}
      >
        {item.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
      </span>
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-mushu-mute)]" />
      <div className="flex-1">
        <p
          className={cn(
            'text-sm',
            item.done
              ? 'text-[var(--color-mushu-mute)] line-through'
              : 'text-[var(--color-mushu-ink)]',
          )}
        >
          <span className="text-[var(--color-mushu-faint)]">{index}.</span> {label}
        </p>
        {!item.done ? (
          <p className="text-[11px] text-[var(--color-mushu-mute)]">{why}</p>
        ) : null}
      </div>
    </div>
  );

  if (item.href && !item.done) {
    return (
      <li>
        <Link href={item.href}>{inner}</Link>
      </li>
    );
  }
  return <li>{inner}</li>;
}
