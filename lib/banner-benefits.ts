import Decimal from 'decimal.js'

import type { BannerBenefit, BannerBenefitReward, BannerRewardType } from '@/types/game-config'

export type BenefitKind = 'one_time' | 'cumulative'

export type BenefitTriggerPoint = {
  triggerPulls: number
  kind: BenefitKind
  freePulls: number
  hasFiveStarBox: boolean
}

const sumReward = (rewards: BannerBenefitReward[], type: BannerRewardType) => {
  let sum = 0
  for (const r of rewards) {
    if (r.type === type) sum += Math.max(0, Math.floor(r.amount))
  }
  return sum
}

const hasRewardType = (rewards: BannerBenefitReward[], type: BannerRewardType) => {
  for (const r of rewards) {
    if (r.type === type && Math.floor(r.amount) > 0) return true
  }
  return false
}

const buildTriggerMap = (benefits: BannerBenefit[] | undefined, kind: BenefitKind) => {
  const map = new Map<number, { freePulls: number; hasFiveStarBox: boolean }>()
  for (const b of benefits ?? []) {
    if (b.kind !== kind) continue
    for (const step of b.steps) {
      const t = Math.max(0, Math.floor(step.triggerPulls))
      const free = sumReward(step.rewards, 'free_pulls')
      const hasBox = hasRewardType(step.rewards, 'select_up_five_star_box')
      if (free === 0 && !hasBox) continue
      const existing = map.get(t)
      if (existing) {
        existing.freePulls += free
        existing.hasFiveStarBox = existing.hasFiveStarBox || hasBox
      } else {
        map.set(t, { freePulls: free, hasFiveStarBox: hasBox })
      }
    }
  }
  return map
}

export const extractBenefitTriggerPoints = (benefits: BannerBenefit[] | undefined): BenefitTriggerPoint[] => {
  const points: BenefitTriggerPoint[] = []
  for (const kind of ['one_time', 'cumulative'] as const) {
    const map = buildTriggerMap(benefits, kind)
    for (const [triggerPulls, v] of map.entries()) {
      points.push({
        triggerPulls,
        kind,
        freePulls: v.freePulls,
        hasFiveStarBox: v.hasFiveStarBox
      })
    }
  }
  points.sort((a, b) => a.triggerPulls - b.triggerPulls)
  return points
}

export const simulateTotalPullsWithBenefits = (
  paidPulls: number,
  benefits: BannerBenefit[] | undefined
) => {
  const paid = Math.max(0, Math.floor(paidPulls))

  const oneTime = buildTriggerMap(benefits, 'one_time')
  const cumulative = buildTriggerMap(benefits, 'cumulative')

  let paidRemain = paid
  let freeRemain = 0
  let total = 0

  const initialOneTime = oneTime.get(0)
  if (initialOneTime) freeRemain += initialOneTime.freePulls

  const initialCumu = cumulative.get(0)
  if (initialCumu) freeRemain += initialCumu.freePulls

  while (paidRemain > 0 || freeRemain > 0) {
    if (freeRemain > 0) freeRemain -= 1
    else paidRemain -= 1

    total += 1

    const ot = oneTime.get(total)
    if (ot) freeRemain += ot.freePulls

    const cu = cumulative.get(total)
    if (cu) freeRemain += cu.freePulls
  }

  return {
    paidPulls: paid,
    totalPulls: total
  }
}

export type EffectiveCostPoint = {
  paidPulls: number
  totalPulls: number
  avgDiamondPerPull: number
}

export const buildEffectiveDiamondCostSeries = (
  costPerPaidPull: Decimal.Value,
  benefits: BannerBenefit[] | undefined,
  maxPaidPulls: number
): EffectiveCostPoint[] => {
  const maxPaid = Math.max(0, Math.floor(maxPaidPulls))
  const cost = new Decimal(costPerPaidPull)

  const series: EffectiveCostPoint[] = []
  for (let p = 0; p <= maxPaid; p++) {
    const sim = simulateTotalPullsWithBenefits(p, benefits)
    const total = sim.totalPulls
    const avg = total <= 0 ? new Decimal(0) : cost.mul(p).div(total)
    series.push({
      paidPulls: p,
      totalPulls: total,
      avgDiamondPerPull: avg.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    })
  }
  return series
}

