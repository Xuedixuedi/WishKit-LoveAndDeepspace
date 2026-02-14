import Decimal from 'decimal.js'
import assert from 'node:assert/strict'

import { GENSHIN_IMPACT_CONFIG } from '@/data/genshin-impact'
import { simulateGacha } from '@/lib/gacha-sim'
import { optimizeShopping } from '@/lib/shopping-optimizer'

const pity = GENSHIN_IMPACT_CONFIG.pitySystems[0]

{
  const result = simulateGacha(pity, 1, 2000)
  assert.ok(result.distribution.length > 0)
  assert.ok(result.expectedValue > 0)
  assert.ok(result.percentiles.p10 <= result.percentiles.p50)
  assert.ok(result.percentiles.p50 <= result.percentiles.p90)
}

{
  const plan = optimizeShopping('160', GENSHIN_IMPACT_CONFIG.rechargePacks)
  assert.ok(new Decimal(plan.gainedCurrency).greaterThanOrEqualTo('160'))
  assert.ok(new Decimal(plan.totalCostCNY).greaterThan(0))
  assert.ok(plan.list.length > 0)
}

console.log('smoke ok')

