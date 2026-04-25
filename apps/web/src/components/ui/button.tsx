import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-[var(--color-mushu-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mushu-amber)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-mushu-scarlet)] text-white hover:bg-[var(--color-mushu-scarlet-soft)]',
        ghost: 'hover:bg-[var(--color-mushu-surface-hover)] text-[var(--color-mushu-ink)]',
        outline:
          'border border-[var(--color-mushu-border)] bg-transparent hover:bg-[var(--color-mushu-surface-hover)]',
        secondary:
          'bg-[var(--color-mushu-surface)] text-[var(--color-mushu-ink)] hover:bg-[var(--color-mushu-surface-hover)]',
        destructive: 'bg-[var(--color-mushu-danger)] text-white hover:opacity-90',
        link: 'text-[var(--color-mushu-amber)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
});
