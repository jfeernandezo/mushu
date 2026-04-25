import { type VariantProps, cva } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--color-mushu-scarlet)]/15 text-[var(--color-mushu-scarlet-soft)]',
        success:
          'border-transparent bg-[var(--color-mushu-success)]/15 text-[var(--color-mushu-success)]',
        warning:
          'border-transparent bg-[var(--color-mushu-amber)]/15 text-[var(--color-mushu-amber)]',
        danger:
          'border-transparent bg-[var(--color-mushu-danger)]/15 text-[var(--color-mushu-danger)]',
        outline: 'border-[var(--color-mushu-border)] text-[var(--color-mushu-mute)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
