'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/components/theme-provider';
import { THEME_COLORS } from '@/lib/theme-colors';

export interface ChartPoint {
  day: string;
  current: number;
  previous: number;
}

interface MessagesChartProps {
  data: ChartPoint[];
}

export function MessagesChart({ data }: MessagesChartProps) {
  const { resolved } = useTheme();
  const palette = THEME_COLORS[resolved];

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
          <XAxis
            dataKey="day"
            stroke={palette.faint}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={palette.faint}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            cursor={{ stroke: palette.border, strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: palette.surface,
              border: `1px solid ${palette.border}`,
              borderRadius: 8,
              fontSize: 12,
              color: palette.ink,
            }}
            labelStyle={{ color: palette.mute }}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke={palette.scarlet}
            strokeWidth={2}
            dot={false}
            name="This week"
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke={palette.amber}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            name="Last week"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
