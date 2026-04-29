import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Primary CTA. Render as link if `href`, button if `onClick`. */
  action?: EmptyStateAction;
  /** Secondary CTA, less prominent. */
  secondaryAction?: EmptyStateAction;
  /** Optional class on the outer container — most callers won't need it. */
  className?: string;
  /** Compact variant (smaller icon + tighter spacing) for use inside small panels. */
  size?: 'default' | 'compact';
}

/**
 * Standard empty-state visual: icon + title + description + optional CTAs.
 * Replaces ad-hoc "no data" centered text scattered across the app.
 *
 * Three usage patterns:
 *   1. Page-level empty (e.g. inbox without any connected account):
 *      icon + headline + CTA button. Default size.
 *   2. List/section empty (e.g. lista de conversas vazia):
 *      compact size, no icon or smaller icon, optional secondary "clear filters".
 *   3. Pane "nothing selected" (e.g. inbox sem conversa selecionada):
 *      compact, friendlier copy, no action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'default',
}: EmptyStateProps) {
  const isCompact = size === 'compact';
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center px-6 text-center',
        isCompact ? 'gap-2 py-8' : 'gap-3 py-16',
        className,
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn(
            'text-[var(--color-mushu-faint)]',
            isCompact ? 'h-8 w-8' : 'h-10 w-10',
          )}
        />
      ) : null}
      <h2
        className={cn(
          'font-medium text-[var(--color-mushu-ink)]',
          isCompact ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'max-w-sm text-[var(--color-mushu-mute)]',
            isCompact ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className={cn('flex flex-wrap items-center justify-center gap-2', isCompact ? 'mt-1' : 'mt-2')}>
          {action ? <ActionButton action={action} primary /> : null}
          {secondaryAction ? <ActionButton action={secondaryAction} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({ action, primary }: { action: EmptyStateAction; primary?: boolean }) {
  const variant = action.variant ?? (primary ? 'default' : 'outline');
  if (action.href) {
    return (
      <Button asChild size="sm" variant={variant}>
        <a href={action.href}>{action.label}</a>
      </Button>
    );
  }
  return (
    <Button size="sm" variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}
