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

export interface ChartPoint {
  day: string;
  current: number;
  previous: number;
}

interface MessagesChartProps {
  data: ChartPoint[];
}

export function MessagesChart({ data }: MessagesChartProps) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#26262A" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="#5A5A5E"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#5A5A5E"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            cursor={{ stroke: '#26262A', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: '#141416',
              border: '1px solid #26262A',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#8B8B8E' }}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="#C73E1D"
            strokeWidth={2}
            dot={false}
            name="This week"
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="#FFC107"
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
