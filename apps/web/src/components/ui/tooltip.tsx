'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Wrap the whole app (or a relevant subtree) once. Sets `delayDuration` to
 * 200ms — long enough to avoid flickers as the user moves the cursor across
 * a UI, short enough that intentional hovers feel snappy.
 */
export const TooltipProvider = ({
  delayDuration = 200,
  ...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
);

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-xs rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-2.5 py-1.5 text-[11px] text-[var(--color-mushu-ink)] shadow-md',
          'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});

/**
 * Convenience wrapper for the typical case: a hint shown over a single child.
 * Most callers only need this — drop into a button, an icon, anywhere a quick
 * hover-explainer helps:
 *
 *   <Tooltip content="This will purge old events">
 *     <Button>...</Button>
 *   </Tooltip>
 *
 * For multi-line or rich content, use the lower-level `TooltipRoot` /
 * `TooltipContent` directly.
 */
export function Tooltip({
  children,
  content,
  side,
  align,
}: {
  children: ReactNode;
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
}
