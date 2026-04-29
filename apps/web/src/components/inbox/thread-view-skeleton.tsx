import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholder while a conversation's full thread is fetching. Mirrors the
 * three sections of `ThreadView`: header (contact + window indicator),
 * scrollable message bubbles, and the compose box at the bottom.
 *
 * Bubble alignment alternates left/right to read as a real conversation.
 */
export function ThreadViewSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true" aria-live="polite">
      <header className="flex items-center justify-between border-b border-[var(--color-mushu-border)] px-4 py-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-2.5 w-32" />
        </div>
        <Skeleton className="h-5 w-24 rounded-full" />
      </header>

      <div className="flex-1 overflow-hidden px-4 py-4">
        <ul className="flex flex-col gap-3">
          <BubbleRow side="left" widthClass="w-2/3" lines={2} />
          <BubbleRow side="right" widthClass="w-1/2" lines={1} />
          <BubbleRow side="left" widthClass="w-3/5" lines={2} />
          <BubbleRow side="right" widthClass="w-1/3" lines={1} />
          <BubbleRow side="left" widthClass="w-1/2" lines={1} />
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] p-3">
        <Skeleton className="h-16 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

function BubbleRow({
  side,
  widthClass,
  lines,
}: {
  side: 'left' | 'right';
  widthClass: string;
  lines: number;
}) {
  return (
    <li className={side === 'right' ? 'flex justify-end' : 'flex justify-start'}>
      <div className={`flex flex-col gap-1.5 ${widthClass}`}>
        {Array.from({ length: lines }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional placeholders
          <Skeleton key={i} className="h-4 w-full rounded-md" />
        ))}
      </div>
    </li>
  );
}
