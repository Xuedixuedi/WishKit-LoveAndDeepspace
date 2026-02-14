'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { BannerBenefit } from '@/types/game-config'
import { extractBenefitTriggerPoints } from '@/lib/banner-benefits'

type ChartPoint = {
  triggerPulls: number
  oneTimeFreePulls: number
  cumulativeFreePulls: number
  hasFiveStarBox: boolean
}

const mergePoints = (benefits: BannerBenefit[] | undefined): ChartPoint[] => {
  const map = new Map<number, ChartPoint>()
  for (const p of extractBenefitTriggerPoints(benefits)) {
    const t = p.triggerPulls
    const existing = map.get(t)
    if (!existing) {
      map.set(t, {
        triggerPulls: t,
        oneTimeFreePulls: p.kind === 'one_time' ? p.freePulls : 0,
        cumulativeFreePulls: p.kind === 'cumulative' ? p.freePulls : 0,
        hasFiveStarBox: p.hasFiveStarBox
      })
    } else {
      if (p.kind === 'one_time') existing.oneTimeFreePulls += p.freePulls
      else existing.cumulativeFreePulls += p.freePulls
      existing.hasFiveStarBox = existing.hasFiveStarBox || p.hasFiveStarBox
    }
  }
  return Array.from(map.values()).sort((a, b) => a.triggerPulls - b.triggerPulls)
}

export function BannerBenefitsChart({ benefits }: { benefits: BannerBenefit[] | undefined }) {
  const data = mergePoints(benefits)

  return (
    <div className="h-72 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey="triggerPulls"
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
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(63, 63, 70, 0.2)' }}
            contentStyle={{
              background: 'rgba(9, 9, 11, 0.95)',
              border: '1px solid #27272a',
              borderRadius: 12,
              color: '#fafafa'
            }}
            labelStyle={{ color: '#e4e4e7' }}
            labelFormatter={(label) => `累计抽数：${label}`}
            formatter={(value, name, item) => {
              const point = item.payload as ChartPoint
              const label =
                name === 'oneTimeFreePulls'
                  ? '一次性福利'
                  : name === 'cumulativeFreePulls'
                    ? '累抽福利'
                    : `${name}`
              const extra = point.hasFiveStarBox ? '（含五星盒子）' : ''
              return [`${value} 抽${extra}`, label]
            }}
          />
          <Legend
            wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }}
            formatter={(value) =>
              value === 'oneTimeFreePulls' ? '一次性福利' : value === 'cumulativeFreePulls' ? '累抽福利' : value
            }
          />

          <Bar
            dataKey="oneTimeFreePulls"
            stackId="a"
            fill="#a855f7"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="cumulativeFreePulls"
            stackId="a"
            fill="#22d3ee"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

