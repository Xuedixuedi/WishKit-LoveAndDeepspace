import Decimal from 'decimal.js'

import type { RechargePack } from '@/types/game-config'

export interface PackEfficiency {
  packId: string
  packName: string
  priceCNY: string
  gainedCurrency: string
  cnyPerCurrency: string
  cnyPerPullAt160: string
  isFirstPurchaseVariant: boolean
}

export interface ShoppingListItem {
  packId: string
  packName: string
  count: number
  isFirstPurchaseVariant: boolean
  priceCNY: string
  gainedCurrency: string
}

export interface ShoppingPlan {
  neededCurrency: string
  gainedCurrency: string
  overfillCurrency: string
  totalCostCNY: string
  list: ShoppingListItem[]
  efficiencies: PackEfficiency[]
}

interface ItemVariant {
  id: string
  name: string
  isFirstPurchaseVariant: boolean
  gain: number
  costCents: number
}

const toInt = (v: Decimal.Value) =>
  new Decimal(v).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber()

const toCents = (cny: Decimal.Value) =>
  new Decimal(cny).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()

const fromCents = (cents: number) => new Decimal(cents).div(100)

const packTotalGain = (pack: RechargePack) => {
  const premium = new Decimal(pack.premiumAmount)
  if (pack.kind !== 'monthly') return premium
  const days = pack.durationDays ?? 0
  const daily = pack.dailyMainCurrencyAmount ?? '0'
  return premium.add(new Decimal(daily).mul(days))
}

/**
 * 氪金性价比计算 + 最优购买清单
 *
 * 目标：用最少的人民币成本，购买一组礼包，使得“获得的钻” >= neededCurrency。
 *
 * 关键约定：
 * - 这里的“钻”视为一个统一的计价单位（例如：原石 / 创世结晶按 1:1 计入）。
 * - 月卡类礼包：总收益 = 立即获得的付费货币 + 每日收益 * 天数。
 * - 直购礼包：若存在 `firstPurchaseBonusAmount`，则认为“首充档”只能买 1 次；常规档可重复购买。
 *
 * 算法说明（为什么不只用贪心排序）：
 * - “性价比最高先买”是直觉策略，但在离散档位下不一定全局最优（典型反例：
 *   高性价比档位面额太大，导致严重溢出，从而不如多个略低性价比的小档位）。
 * - 因此这里使用动态规划（背包思想）做“精确最小成本”求解。
 *
 * 复杂度：O(N * (needed + maxGain))，适合常见手游档位与几万钻需求。
 */
export function optimizeShopping(
  neededCurrency: Decimal.Value,
  availablePacks: RechargePack[]
): ShoppingPlan {
  const need = Math.max(0, toInt(neededCurrency))
  if (need === 0) {
    return {
      neededCurrency: '0',
      gainedCurrency: '0',
      overfillCurrency: '0',
      totalCostCNY: '0',
      list: [],
      efficiencies: []
    }
  }

  const variants: ItemVariant[] = []

  for (const p of availablePacks) {
    const totalGain = packTotalGain(p)
    const gain = Math.max(0, totalGain.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber())
    const costCents = Math.max(0, toCents(p.priceCNY))
    if (gain <= 0 || costCents <= 0) continue

    variants.push({
      id: p.id,
      name: p.name,
      isFirstPurchaseVariant: false,
      gain,
      costCents
    })

    const bonus = p.firstPurchaseBonusAmount
    if (bonus !== undefined) {
      const bonusGain = totalGain.add(new Decimal(bonus))
      const fgain = Math.max(
        0,
        bonusGain.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber()
      )
      if (fgain > 0) {
        variants.push({
          id: p.id,
          name: p.name,
          isFirstPurchaseVariant: true,
          gain: fgain,
          costCents
        })
      }
    }
  }

  if (variants.length === 0) {
    return {
      neededCurrency: new Decimal(need).toString(),
      gainedCurrency: '0',
      overfillCurrency: new Decimal(need).toString(),
      totalCostCNY: '0',
      list: [],
      efficiencies: []
    }
  }

  const maxGain = variants.reduce((m, v) => Math.max(m, v.gain), 0)
  const limit = need + maxGain

  const dpCost = new Array<number>(limit + 1).fill(Number.POSITIVE_INFINITY)
  const prevAmount = new Array<number>(limit + 1).fill(-1)
  const prevVariant = new Array<number>(limit + 1).fill(-1)

  dpCost[0] = 0

  const unlimitedIdx: number[] = []
  const boundedIdx: number[] = []
  for (let i = 0; i < variants.length; i++) {
    if (variants[i].isFirstPurchaseVariant) boundedIdx.push(i)
    else unlimitedIdx.push(i)
  }

  for (const idx of unlimitedIdx) {
    const item = variants[idx]
    for (let amt = item.gain; amt <= limit; amt++) {
      const from = amt - item.gain
      const candidate = dpCost[from] + item.costCents
      if (candidate < dpCost[amt]) {
        dpCost[amt] = candidate
        prevAmount[amt] = from
        prevVariant[amt] = idx
      }
    }
  }

  for (const idx of boundedIdx) {
    const item = variants[idx]
    for (let amt = limit; amt >= item.gain; amt--) {
      const from = amt - item.gain
      const candidate = dpCost[from] + item.costCents
      if (candidate < dpCost[amt]) {
        dpCost[amt] = candidate
        prevAmount[amt] = from
        prevVariant[amt] = idx
      }
    }
  }

  let bestAmt = -1
  let bestCost = Number.POSITIVE_INFINITY
  for (let amt = need; amt <= limit; amt++) {
    if (dpCost[amt] < bestCost) {
      bestCost = dpCost[amt]
      bestAmt = amt
    }
  }

  if (!Number.isFinite(bestCost) || bestAmt < 0) {
    return {
      neededCurrency: new Decimal(need).toString(),
      gainedCurrency: '0',
      overfillCurrency: new Decimal(need).toString(),
      totalCostCNY: '0',
      list: [],
      efficiencies: []
    }
  }

  const used = new Map<string, { name: string; isFirst: boolean; count: number; gain: number; costCents: number }>()
  let cur = bestAmt
  while (cur > 0) {
    const vidx = prevVariant[cur]
    const pamt = prevAmount[cur]
    if (vidx < 0 || pamt < 0) break
    const v = variants[vidx]
    const key = `${v.id}::${v.isFirstPurchaseVariant ? 'first' : 'normal'}`
    const existing = used.get(key)
    if (existing) existing.count += 1
    else {
      used.set(key, {
        name: v.name,
        isFirst: v.isFirstPurchaseVariant,
        count: 1,
        gain: v.gain,
        costCents: v.costCents
      })
    }
    cur = pamt
  }

  const list: ShoppingListItem[] = Array.from(used.entries()).map(([key, v]) => {
    const [packId] = key.split('::')
    return {
      packId,
      packName: v.name,
      count: v.count,
      isFirstPurchaseVariant: v.isFirst,
      priceCNY: fromCents(v.costCents).toString(),
      gainedCurrency: new Decimal(v.gain).mul(v.count).toString()
    }
  })

  list.sort((a, b) => {
    if (a.isFirstPurchaseVariant !== b.isFirstPurchaseVariant) {
      return a.isFirstPurchaseVariant ? -1 : 1
    }
    return a.packId.localeCompare(b.packId)
  })

  const gained = new Decimal(bestAmt)
  const totalCost = fromCents(bestCost)
  const overfill = gained.sub(new Decimal(need))

  const pullCost = new Decimal(160)
  const efficiencies: PackEfficiency[] = variants
    .map((v) => {
      const gainD = new Decimal(v.gain)
      const costD = fromCents(v.costCents)
      const cnyPerCurrency = costD.div(gainD)
      const cnyPerPull = costD.mul(pullCost).div(gainD)
      return {
        packId: v.id,
        packName: v.name,
        priceCNY: costD.toString(),
        gainedCurrency: gainD.toString(),
        cnyPerCurrency: cnyPerCurrency.toSignificantDigits(8).toString(),
        cnyPerPullAt160: cnyPerPull.toSignificantDigits(8).toString(),
        isFirstPurchaseVariant: v.isFirstPurchaseVariant
      }
    })
    .sort((a, b) => {
      const da = new Decimal(a.cnyPerCurrency)
      const db = new Decimal(b.cnyPerCurrency)
      if (!da.equals(db)) return da.lessThan(db) ? -1 : 1
      if (a.isFirstPurchaseVariant !== b.isFirstPurchaseVariant) {
        return a.isFirstPurchaseVariant ? -1 : 1
      }
      return a.packId.localeCompare(b.packId)
    })

  return {
    neededCurrency: new Decimal(need).toString(),
    gainedCurrency: gained.toString(),
    overfillCurrency: overfill.toString(),
    totalCostCNY: totalCost.toString(),
    list,
    efficiencies
  }
}

