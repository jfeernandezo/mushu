import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  deltaPct?: number;
  icon?: LucideIcon;
  hint?: string;
}

export function StatCard({ label, value, deltaPct, icon: Icon, hint }: StatCardProps) {
  const positive = (deltaPct ?? 0) >= 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-mushu-mute)]">{label}</span>
          {Icon ? <Icon className="h-4 w-4 text-[var(--color-mushu-faint)]" /> : null}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums text-[var(--color-mushu-ink)]">
            {formatNumber(value)}
          </span>
          {deltaPct !== undefined ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                positive ? 'text-[var(--color-mushu-success)]' : 'text-[var(--color-mushu-danger)]',
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(deltaPct).toFixed(1)}%
            </span>
          ) : null}
        </div>

        {hint ? <p className="text-xs text-[var(--color-mushu-faint)]">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
