import { Skeleton } from '@/components/ui/skeleton';

/**
 * Visual placeholder while the conversation list is fetching for the first
 * time, OR while a filter change is in flight and we don't have any
 * conversations yet to show. Mirrors the structure of `ConversationList`'s
 * row: avatar circle + 2 lines of text + a status pill row.
 *
 * Render 6 rows — enough to fill a desktop pane (~600px) and read as a list,
 * not 1-2 rows that read as "loading something specific".
 */
export function ConversationListSkeleton() {
  return (
    <ul className="flex-1 overflow-hidden" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable list of placeholders
        <li
          key={i}
          className="flex items-start gap-3 border-b border-[var(--color-mushu-border)] px-3 py-3"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2.5 w-10" />
            </div>
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-3 w-4/5" />
            <div className="mt-0.5 flex gap-1">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
