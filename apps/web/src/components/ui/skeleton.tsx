import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Generic shimmer skeleton block. Use as a building block for surface-specific
 * skeletons (ConversationListSkeleton, ThreadViewSkeleton). The shimmer is a
 * pure-CSS gradient sweep — no JS, no layout thrash.
 *
 * Theme: uses `--color-mushu-surface` as the base and a slightly brighter
 * `--color-mushu-surface-hover` band sweeping across. Works on both dark and
 * light themes via the existing data-theme switching in globals.css.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-md bg-[var(--color-mushu-surface)]',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-[var(--color-mushu-surface-hover)] before:to-transparent',
        'before:animate-[shimmer_1.6s_infinite]',
        className,
      )}
      {...props}
    />
  );
}
