import Decimal from 'decimal.js'

import type { PitySystem } from '@/types/game-config'

export interface PullDistributionPoint {
  pulls: number
  probability: number
}

export interface GachaPercentiles {
  p10: number
  p50: number
  p90: number
}

export interface GachaSimulationResult {
  distribution: PullDistributionPoint[]
  percentiles: GachaPercentiles
  expectedValue: number
}

export interface GachaInitialState {
  pityCounter: number
  isFeaturedGuaranteed: boolean
}

export interface RandomSource {
  next(): number
}

export const defaultRandomSource: RandomSource = {
  next: () => Math.random()
}

export const createMulberry32 = (seed: number): RandomSource => {
  let t = seed >>> 0
  return {
    next: () => {
      t += 0x6d2b79f5
      let r = Math.imul(t ^ (t >>> 15), t | 1)
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
  }
}

const clamp01 = (x: Decimal) => {
  if (x.lessThan(0)) return new Decimal(0)
  if (x.greaterThan(1)) return new Decimal(1)
  return x
}

const percentileFromSorted = (
  sortedPulls: Array<{ pulls: number; count: number }>,
  totalRuns: number,
  percentile: Decimal
) => {
  const target = clamp01(percentile)
  let cum = new Decimal(0)
  for (const p of sortedPulls) {
    cum = cum.add(new Decimal(p.count).div(totalRuns))
    if (cum.greaterThanOrEqualTo(target)) return p.pulls
  }
  return sortedPulls.length > 0 ? sortedPulls[sortedPulls.length - 1].pulls : 0
}

const currentFiveStarRate = (config: PitySystem, pityCounter: number) => {
  const base = new Decimal(config.baseRate)
  const hard = config.hardPity

  const currentPullIndex = pityCounter + 1
  if (currentPullIndex >= hard) return new Decimal(1)

  const softStart = config.softPityStart
  const increase = config.softPityIncreasePerPull
  if (softStart === null || increase === null) return clamp01(base)

  if (currentPullIndex < softStart) return clamp01(base)

  const softSteps = currentPullIndex - softStart + 1
  return clamp01(base.add(new Decimal(increase).mul(softSteps)))
}

/**
 * 抽卡模拟器
 *
 * 数学逻辑说明：
 *
 * 1) “保底”本质上是在每一次抽取时，给出一个“当前出五星概率”。
 *    - 基础概率：`baseRate`
 *    - 软保底：从 `softPityStart` 开始，每抽增加 `softPityIncreasePerPull`
 *    - 硬保底：到 `hardPity` 时必出（概率视为 1）
 *
 * 2) “小保底/大保底”用于描述：出五星后，是否为“当期 UP（featured）”。
 *    - 若当前不处于大保底：按 `featuredWinRate` 决定是否中 UP
 *    - 若已经歪了 `guaranteedAfterLoses` 次（例如原神为 1 次），则下一次五星必为 UP
 *
 * 3) 本函数用 Monte Carlo（蒙特卡洛）模拟：重复 simRuns 次，统计达到目标 UP 次数所需抽数。
 *    - 输出抽数分布（用于画概率分布图）
 *    - 输出 10%/50%/90% 分位数（欧皇/平均/非酋）
 *    - 输出期望抽数（数学期望）
 */
export function simulateGacha(
  config: PitySystem,
  targetCount: number,
  simRuns: number = 10000,
  rng: RandomSource = defaultRandomSource
): GachaSimulationResult {
  return simulateGachaWithState(
    config,
    targetCount,
    { pityCounter: 0, isFeaturedGuaranteed: false },
    simRuns,
    rng
  )
}

export function simulateGachaWithState(
  config: PitySystem,
  targetCount: number,
  initialState: GachaInitialState,
  simRuns: number = 10000,
  rng: RandomSource = defaultRandomSource
): GachaSimulationResult {
  const runs = Math.max(1, Math.floor(simRuns))
  const target = Math.max(1, Math.floor(targetCount))

  const featuredWinRate = clamp01(new Decimal(config.featuredWinRate))
  const hardPity = Math.max(1, Math.floor(config.hardPity))
  const guaranteedAfterLoses = Math.max(0, Math.floor(config.guaranteedAfterLoses))

  const counts = new Map<number, number>()

  for (let r = 0; r < runs; r++) {
    let pulls = 0
    let pityCounter = Math.max(0, Math.floor(initialState.pityCounter))
    let featuredCount = 0
    let loseCount = initialState.isFeaturedGuaranteed ? guaranteedAfterLoses : 0

    while (featuredCount < target) {
      pulls += 1

      const rate = currentFiveStarRate(config, pityCounter)
      const roll = rng.next()
      const isFiveStar = roll < rate.toNumber()

      if (!isFiveStar) {
        pityCounter = Math.min(pityCounter + 1, hardPity)
        continue
      }

      pityCounter = 0

      const isGuaranteed = guaranteedAfterLoses > 0 && loseCount >= guaranteedAfterLoses
      if (isGuaranteed) {
        featuredCount += 1
        loseCount = 0
        continue
      }

      const featuredRoll = rng.next()
      const isFeatured = featuredRoll < featuredWinRate.toNumber()
      if (isFeatured) {
        featuredCount += 1
        loseCount = 0
      } else {
        loseCount += 1
      }
    }

    counts.set(pulls, (counts.get(pulls) ?? 0) + 1)
  }

  const sorted = Array.from(counts.entries())
    .map(([pulls, count]) => ({ pulls, count }))
    .sort((a, b) => a.pulls - b.pulls)

  const distribution: PullDistributionPoint[] = sorted.map((p) => ({
    pulls: p.pulls,
    probability: new Decimal(p.count).div(runs).toNumber()
  }))

  let expected = new Decimal(0)
  for (const p of sorted) {
    expected = expected.add(new Decimal(p.pulls).mul(new Decimal(p.count).div(runs)))
  }

  const percentiles: GachaPercentiles = {
    p10: percentileFromSorted(sorted, runs, new Decimal('0.1')),
    p50: percentileFromSorted(sorted, runs, new Decimal('0.5')),
    p90: percentileFromSorted(sorted, runs, new Decimal('0.9'))
  }

  return {
    distribution,
    percentiles,
    expectedValue: expected.toNumber()
  }
}
