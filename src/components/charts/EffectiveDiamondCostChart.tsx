'use client'

import Decimal from 'decimal.js'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { BannerBenefit } from '@/types/game-config'
import { buildEffectiveDiamondCostSeries, extractBenefitTriggerPoints } from '@/lib/banner-benefits'

type ChartPoint = {
  paidPulls: number
  avgDiamondPerPull: number
  totalPulls: number
}

export function EffectiveDiamondCostChart({
  costPerPull,
  benefits,
  maxPaidPulls
}: {
  costPerPull: Decimal.Value
  benefits: BannerBenefit[] | undefined
  maxPaidPulls: number
}) {
  const baseCost = new Decimal(costPerPull)
  const series = buildEffectiveDiamondCostSeries(costPerPull, benefits, maxPaidPulls)
  const data: ChartPoint[] = series.map((p) => ({
    paidPulls: p.paidPulls,
    avgDiamondPerPull: p.avgDiamondPerPull,
    totalPulls: p.totalPulls
  }))

  const markerPaidPulls = (() => {
    const triggers = Array.from(
      new Set(extractBenefitTriggerPoints(benefits).map((p) => Math.max(0, Math.floor(p.triggerPulls))))
    ).filter((t) => t > 0)
    const paidSet = new Set<number>()
    for (const t of triggers) {
      const hit = series.find((p) => p.totalPulls >= t)
      if (hit) paidSet.add(hit.paidPulls)
    }
    return Array.from(paidSet.values()).sort((a, b) => a - b)
  })()

  return (
    <div className="h-72 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey="paidPulls"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={{ stroke: '#3f3f46' }}
            minTickGap={20}
            tickFormatter={(v) => `${v}`}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={{ stroke: '#3f3f46' }}
            width={52}
            tickFormatter={(v) => `${v}`}
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
            labelFormatter={(label) => `付费抽数：${label}`}
            formatter={(value) => [`${Number(value).toFixed(2)} 钻/抽`, '平均每抽成本']}
          />
          <Legend
            wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }}
            formatter={(value) => (value === 'avgDiamondPerPull' ? '含福利的平均每抽成本' : value)}
          />

          <ReferenceLine
            y={baseCost.toNumber()}
            stroke="#fbbf24"
            strokeOpacity={0.65}
            strokeDasharray="6 6"
            label={{
              value: `标称成本：${baseCost.toString()} 钻/抽`,
              position: 'insideTopRight',
              fill: '#fde68a',
              fontSize: 12
            }}
          />

          {markerPaidPulls.map((x) => (
            <ReferenceLine
              key={x}
              x={x}
              stroke="#3f3f46"
              strokeOpacity={0.55}
              strokeDasharray="2 6"
            />
          ))}

          <Line
            type="monotone"
            dataKey="avgDiamondPerPull"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: '#67e8f9', strokeWidth: 1.5, fill: '#0ea5e9' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
