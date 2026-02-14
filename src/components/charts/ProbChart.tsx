'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { PullDistributionPoint } from '@/lib/gacha-sim'

type ChartPoint = {
  pulls: number
  probabilityPercent: number
}

export function ProbChart({
  distribution,
  softPityStart,
  softPityLabel
}: {
  distribution: PullDistributionPoint[]
  softPityStart: number | null
  softPityLabel?: string
}) {
  const data: ChartPoint[] = distribution.map((d) => ({
    pulls: d.pulls,
    probabilityPercent: d.probability * 100
  }))

  return (
    <div className="h-72 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="goldPurple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.35} />
              <stop offset="55%" stopColor="#a855f7" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#09090b" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="strokeGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="55%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#27272a" strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey="pulls"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={{ stroke: '#3f3f46' }}
            minTickGap={16}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={{ stroke: '#3f3f46' }}
            width={44}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ stroke: '#3f3f46', strokeDasharray: '3 6' }}
            contentStyle={{
              background: 'rgba(9, 9, 11, 0.95)',
              border: '1px solid #27272a',
              borderRadius: 12,
              color: '#fafafa'
            }}
            labelStyle={{ color: '#e4e4e7' }}
            formatter={(value) => [`${Number(value).toFixed(2)}%`, '达成概率']}
            labelFormatter={(label) => `抽数：${label}`}
          />

          {softPityStart !== null ? (
            <ReferenceLine
              x={softPityStart}
              stroke="#fbbf24"
              strokeOpacity={0.8}
              strokeDasharray="6 6"
              label={{
                value: softPityLabel ?? '软保底',
                position: 'insideTopRight',
                fill: '#fde68a',
                fontSize: 12
              }}
            />
          ) : null}

          <Area
            type="monotone"
            dataKey="probabilityPercent"
            stroke="url(#strokeGlow)"
            strokeWidth={2}
            fill="url(#goldPurple)"
            dot={false}
            activeDot={{ r: 4, stroke: '#fde68a', strokeWidth: 1.5, fill: '#a855f7' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
