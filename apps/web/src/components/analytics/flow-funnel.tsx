'use client';

import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/components/theme-provider';
import { THEME_COLORS } from '@/lib/theme-colors';

interface Step {
  nodeId: string;
  nodeType: string;
  reached: number;
  outcomes: Record<string, number>;
}

export function FlowFunnel({ steps }: { steps: Step[] }) {
  const t = useTranslations('analytics');
  const { resolved } = useTheme();
  const palette = THEME_COLORS[resolved];
  const data = steps.map((step, index) => ({
    ...step,
    label: `${index + 1}. ${t(`nodes.${step.nodeType.replace('.', '_')}`)}`,
  }));
  const outcomeLabel = (value: string) =>
    value.startsWith('branch-')
      ? t('branch', { number: Number(value.slice(7)) + 1 })
      : t.has(`outcomes.${value}`)
        ? t(`outcomes.${value}`)
        : value;

  return (
    <div className="space-y-4">
      <div style={{ height: Math.max(180, steps.length * 38) }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ right: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.border} horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke={palette.faint} />
            <YAxis
              type="category"
              dataKey="label"
              width={180}
              stroke={palette.mute}
              fontSize={11}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: palette.surface,
                border: `1px solid ${palette.border}`,
                color: palette.ink,
                borderRadius: 8,
              }}
            />
            <Bar
              dataKey="reached"
              name={t('reached')}
              fill={palette.scarlet}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-mushu-border)]">
              <th className="py-2">{t('step')}</th>
              <th>{t('reached')}</th>
              <th>{t('outcome')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((step) => (
              <tr
                key={`${step.nodeId}:${step.nodeType}`}
                className="border-b border-[var(--color-mushu-border)]"
              >
                <td className="py-2">
                  {step.label}
                  <span className="block text-xs text-[var(--color-mushu-mute)]">
                    {step.nodeId}
                  </span>
                </td>
                <td>{step.reached}</td>
                <td>
                  {Object.entries(step.outcomes)
                    .map(([outcome, count]) => `${outcomeLabel(outcome)}: ${count}`)
                    .join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
