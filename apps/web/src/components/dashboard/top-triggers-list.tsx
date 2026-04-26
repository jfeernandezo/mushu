import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface TopTrigger {
  label: string;
  fires: number;
  pct: number; // 0..1 width fraction
}

interface TopTriggersListProps {
  items: TopTrigger[];
}

export async function TopTriggersList({ items }: TopTriggersListProps) {
  const t = await getTranslations('dashboard.topTriggers');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-[var(--color-mushu-faint)]">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                <span className="w-32 truncate text-sm text-[var(--color-mushu-mute)]">
                  {item.label}
                </span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-mushu-surface-hover)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-mushu-scarlet)]"
                    style={{ width: `${Math.max(0, Math.min(1, item.pct)) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-[var(--color-mushu-faint)]">
                  {item.fires}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
