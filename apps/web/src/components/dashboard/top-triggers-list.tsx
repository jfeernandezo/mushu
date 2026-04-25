import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface TopTrigger {
  label: string;
  fires: number;
  pct: number; // 0..1 width fraction
}

interface TopTriggersListProps {
  items: TopTrigger[];
}

export function TopTriggersList({ items }: TopTriggersListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top triggers</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--color-mushu-faint)]">
            No triggers fired yet. They'll show up here once your flows are live.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((t) => (
              <li key={t.label} className="flex items-center gap-3">
                <span className="w-32 truncate text-sm text-[var(--color-mushu-mute)]">
                  {t.label}
                </span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-mushu-surface-hover)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-mushu-scarlet)]"
                    style={{ width: `${Math.max(0, Math.min(1, t.pct)) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-[var(--color-mushu-faint)]">
                  {t.fires}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
