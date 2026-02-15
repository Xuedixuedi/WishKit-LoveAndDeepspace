'use client'

import * as React from 'react'
import Decimal from 'decimal.js'

import type { Banner, BannerType } from '@/types/game-config'
import { BannerBenefitsChart } from '@/components/charts/BannerBenefitsChart'
import { EffectiveDiamondCostChart } from '@/components/charts/EffectiveDiamondCostChart'
import { ProbChart } from '@/components/charts/ProbChart'
import { ShoppingList } from '@/components/analysis/ShoppingList'
import { SummaryLine } from '@/components/analysis/SummaryLine'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { convertByDirectRate, findDirectExchangeRate } from '@/lib/currency-exchange'
import { extractBenefitTriggerPoints } from '@/lib/banner-benefits'
import { simulateGachaWithState } from '@/lib/gacha-sim'
import { optimizeShopping } from '@/lib/shopping-optimizer'
import { useGameStore } from '@/store/use-game-store'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const formatInt = (value: Decimal.Value) =>
  new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString()

const safeIntString = (raw: string) => {
  const trimmed = raw.trim()
  if (trimmed === '') return '0'
  try {
    const d = new Decimal(trimmed)
    if (!d.isFinite() || d.isNeg()) return '0'
    return d.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString()
  } catch {
    return '0'
  }
}

const bannerTypeKey = (t: BannerType | undefined) => t ?? 'unknown'

const bannerTypeLabel = (t: BannerType | undefined) => {
  switch (t) {
    case 'single_month':
      return '单人月卡池'
    case 'birthday':
      return '生日卡池'
    case 'mixed':
      return '混池'
    case 'daily':
      return '日卡池'
    default:
      return '卡池'
  }
}

const bannerCategoryLabel = (b: Banner) => {
  if (b.category === 'new') return '新卡池'
  if (b.category === 'rerun') return '复刻池'
  return '未分类'
}

const formatTargetCount = (target: number, unit: string) => {
  const n = Math.max(1, Math.floor(target))
  if (unit.length <= 1) return `${n}${unit}`
  return `${n} 张${unit}`
}

export default function Home() {
  const gameConfig = useGameStore((s) => s.gameConfig)
  const userSettings = useGameStore((s) => s.userSettings)
  const targetSettings = useGameStore((s) => s.targetSettings)
  const actions = useGameStore((s) => s.actions)

  const banner = React.useMemo(() => {
    return (
      gameConfig.banners.find((b) => b.id === targetSettings.bannerId) ??
      gameConfig.banners[0] ??
      null
    )
  }, [gameConfig.banners, targetSettings.bannerId])

  const pitySystem = React.useMemo(() => {
    if (!banner) return gameConfig.pitySystems[0]
    return (
      gameConfig.pitySystems.find((p) => p.id === banner.pitySystemId) ??
      gameConfig.pitySystems[0]
    )
  }, [banner, gameConfig.pitySystems])

  const ui = gameConfig.ui
  const pullLabel = ui?.pullLabel ?? '抽'
  const targetUnit = ui?.targetUnitName ?? '命'
  const targetCountLabel = ui?.targetCountLabel ?? '目标数量'
  const softPityLabel = ui?.softPityLabel ?? '软保底'
  const hardPityLabel = ui?.hardPityLabel ?? '硬保底'

  const mainCurrency = gameConfig.currencies.find((c) => c.id === gameConfig.defaultMainCurrencyId)
  const premiumCurrency = gameConfig.currencies.find(
    (c) => c.id === gameConfig.defaultPremiumCurrencyId
  )
  const mainCurrencyName = mainCurrency?.name ?? '主货币'
  const premiumCurrencyName = premiumCurrency?.name ?? '付费货币'

  const debouncedPity = useDebouncedValue(userSettings.pityCounter, 250)
  const debouncedOwned = useDebouncedValue(userSettings.ownedMainCurrency, 250)
  const debouncedOwnedPremium = useDebouncedValue(userSettings.ownedPremiumCurrency, 250)
  const debouncedGuaranteed = useDebouncedValue(userSettings.isFeaturedGuaranteed, 250)

  const targetCount = Math.max(1, Math.floor(targetSettings.targetFiveStarCount))
  const costPerPull = React.useMemo(() => new Decimal(banner?.costPerPull ?? '0'), [banner?.costPerPull])
  const costCurrencyName =
    gameConfig.currencies.find((c) => c.id === (banner?.costCurrencyId ?? ''))?.name ?? mainCurrencyName

  const premiumToMainRate = React.useMemo(() => {
    const r = findDirectExchangeRate(
      gameConfig,
      gameConfig.defaultPremiumCurrencyId,
      gameConfig.defaultMainCurrencyId
    )
    return r ? new Decimal(r.rate) : null
  }, [gameConfig])

  const ownedMainEquivalent = React.useMemo(() => {
    const ownedMain = new Decimal(debouncedOwned)
    const ownedPremium = new Decimal(debouncedOwnedPremium)
    if (!ownedMain.isFinite() || ownedMain.isNeg()) return new Decimal(0)
    if (!ownedPremium.isFinite() || ownedPremium.isNeg()) return ownedMain

    const converted = convertByDirectRate(
      gameConfig,
      ownedPremium,
      gameConfig.defaultPremiumCurrencyId,
      gameConfig.defaultMainCurrencyId
    )
    return ownedMain.add(converted ?? new Decimal(0))
  }, [debouncedOwned, debouncedOwnedPremium, gameConfig])

  const simulation = React.useMemo(() => {
    return simulateGachaWithState(
      pitySystem,
      targetCount,
      {
        pityCounter: debouncedPity,
        isFeaturedGuaranteed: debouncedGuaranteed
      },
      5000
    )
  }, [debouncedGuaranteed, debouncedPity, pitySystem, targetCount])

  const pullsP10 = simulation.percentiles.p10
  const pullsP50 = simulation.percentiles.p50
  const pullsP90 = simulation.percentiles.p90

  const needForP50 = React.useMemo(() => {
    const total = new Decimal(pullsP50).mul(costPerPull)
    const owned = ownedMainEquivalent
    return Decimal.max(0, total.sub(owned))
  }, [costPerPull, ownedMainEquivalent, pullsP50])

  const needForP90 = React.useMemo(() => {
    const total = new Decimal(pullsP90).mul(costPerPull)
    const owned = ownedMainEquivalent
    return Decimal.max(0, total.sub(owned))
  }, [costPerPull, ownedMainEquivalent, pullsP90])

  const shoppingPlan = React.useMemo(() => {
    return optimizeShopping(needForP50, gameConfig.rechargePacks)
  }, [gameConfig.rechargePacks, needForP50])

  const shoppingPlanP90 = React.useMemo(() => {
    return optimizeShopping(needForP90, gameConfig.rechargePacks)
  }, [gameConfig.rechargePacks, needForP90])

  const targetText = `${targetSettings.targetName}（${formatTargetCount(targetCount, targetUnit)}）`

  const availablePulls = React.useMemo(() => {
    if (!costPerPull.isFinite() || costPerPull.lte(0)) return 0
    return ownedMainEquivalent.div(costPerPull).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber()
  }, [costPerPull, ownedMainEquivalent])

  const bannersByType = React.useMemo(() => {
    const map = new Map<string, Banner[]>()
    for (const b of gameConfig.banners) {
      const key = bannerTypeKey(b.type)
      const existing = map.get(key)
      if (existing) existing.push(b)
      else map.set(key, [b])
    }
    return map
  }, [gameConfig.banners])

  const currentType = bannerTypeKey(banner?.type)

  const benefitPoints = React.useMemo(() => extractBenefitTriggerPoints(banner?.benefits), [banner])
  const oneTimeFreePulls = React.useMemo(() => {
    let sum = 0
    for (const p of benefitPoints) {
      if (p.kind === 'one_time') sum += p.freePulls
    }
    return sum
  }, [benefitPoints])
  const cumulativeFreePulls = React.useMemo(() => {
    let sum = 0
    for (const p of benefitPoints) {
      if (p.kind === 'cumulative') sum += p.freePulls
    }
    return sum
  }, [benefitPoints])
  const maxBenefitTrigger = React.useMemo(() => {
    let m = 0
    for (const p of benefitPoints) m = Math.max(m, p.triggerPulls)
    return m
  }, [benefitPoints])
  const maxPaidForChart = Math.min(300, Math.max(120, maxBenefitTrigger + 30))

  const chanceWithinOwned = React.useMemo(() => {
    let sum = new Decimal(0)
    for (const p of simulation.distribution) {
      if (p.pulls <= availablePulls) sum = sum.add(new Decimal(p.probability))
    }
    return sum.mul(100)
  }, [availablePulls, simulation.distribution])

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(168,85,247,0.25),transparent_40%),radial-gradient(900px_circle_at_90%_20%,rgba(251,191,36,0.14),transparent_45%),radial-gradient(800px_circle_at_40%_90%,rgba(59,130,246,0.10),transparent_45%)]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">抽卡分析与氪金性价比</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {gameConfig.name} · 目标：{targetText}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
            <div className="rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1">
              模拟次数：5000
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-base">输入区</CardTitle>
              <CardDescription>选择卡池并设置资源与目标，目标仅统计当期 UP 五星。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-medium text-zinc-100">卡池类型</div>
                  <div className="text-xs text-zinc-500">切换后自动选中该类型的第一个卡池</div>
                </div>

                <Tabs
                  value={currentType}
                  onValueChange={(key) => {
                    const list = bannersByType.get(key)
                    if (list && list[0]) actions.setBannerId(list[0].id)
                  }}
                >
                  <TabsList className="w-full justify-start">
                    {Array.from(bannersByType.entries()).map(([key, list]) => (
                      <TabsTrigger key={key} value={key}>
                        {bannerTypeLabel(list[0]?.type)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {Array.from(bannersByType.entries()).map(([key, list]) => (
                    <TabsContent key={key} value={key}>
                      <div className="mt-3 grid gap-2">
                        {list.map((b) => {
                          const selected = b.id === banner?.id
                          const bCostCurrencyName =
                            gameConfig.currencies.find((c) => c.id === b.costCurrencyId)?.name ??
                            mainCurrencyName
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => actions.setBannerId(b.id)}
                              className={
                                'w-full rounded-lg border px-3 py-2 text-left transition ' +
                                (selected
                                  ? 'border-purple-500/60 bg-purple-500/10'
                                  : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900/50')
                              }
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-zinc-100">
                                    {b.name}
                                  </div>
                                  <div className="mt-0.5 text-xs text-zinc-400">
                                    {bannerCategoryLabel(b)} · {new Decimal(b.costPerPull).toString()} {bCostCurrencyName}/
                                    {pullLabel}
                                  </div>
                                </div>
                                <Badge variant={b.category === 'new' ? 'purple' : 'secondary'}>
                                  {bannerCategoryLabel(b)}
                                </Badge>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="text-sm font-medium text-zinc-100">卡池规则</div>
                {banner?.ruleDoc && banner.ruleDoc.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                    {banner.ruleDoc.map((line, index) => (
                      <li key={`${banner.id}-rule-${index}`}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 text-xs text-zinc-500">暂未配置规则说明</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-medium text-zinc-100">{targetCountLabel}</div>
                  <div className="text-sm text-zinc-300">{formatTargetCount(targetCount, targetUnit)}</div>
                </div>
                <Slider
                  value={[targetCount]}
                  max={7}
                  min={1}
                  step={1}
                  onValueChange={(v) => actions.setTarget({ targetFiveStarCount: v[0] ?? 1 })}
                />
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>1</span>
                  <span>7</span>
                </div>
                <div className="text-xs text-zinc-500">仅统计当期 UP 五星，不含歪卡五星。</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-medium text-zinc-100">当前已垫抽数</div>
                  <div className="text-sm text-zinc-300">{userSettings.pityCounter}</div>
                </div>
                <Slider
                  value={[userSettings.pityCounter]}
                  max={Math.max(1, pitySystem.hardPity - 1)}
                  min={0}
                  step={1}
                  onValueChange={(v) => actions.setPityCounter(v[0] ?? 0)}
                />
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>0</span>
                  <span>
                    {softPityLabel} {pitySystem.hardPity}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-medium text-zinc-100">当前持有{mainCurrencyName}</div>
                  <div className="text-xs text-zinc-500">用于计算当前可抽与还需补多少</div>
                </div>
                <Input
                  inputMode="numeric"
                  value={userSettings.ownedMainCurrency}
                  onChange={(e) => actions.setOwnedMainCurrency(safeIntString(e.target.value))}
                  placeholder="例如 12800"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-medium text-zinc-100">当前持有{premiumCurrencyName}</div>
                  <div className="text-xs text-zinc-500">
                    {premiumToMainRate ? (
                      <>
                        1 {premiumCurrencyName} = {premiumToMainRate.toString()} {mainCurrencyName}
                      </>
                    ) : (
                      <>未配置汇率</>
                    )}
                  </div>
                </div>
                <Input
                  inputMode="numeric"
                  value={userSettings.ownedPremiumCurrency}
                  onChange={(e) => actions.setOwnedPremiumCurrency(safeIntString(e.target.value))}
                  placeholder="例如 40"
                />
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">当前预算可抽</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      约 {availablePulls} {pullLabel}（按 {costPerPull.toString()} {costCurrencyName}/
                      {pullLabel}）
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => actions.reset()}>
                    重置
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle className="text-base">结果区</CardTitle>
              <CardDescription>输出达到所选张数 UP 五星的期望抽数与概率分析。</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="prob">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="prob">概率分析</TabsTrigger>
                  <TabsTrigger value="benefits">福利与成本</TabsTrigger>
                  <TabsTrigger value="shop">氪金指南</TabsTrigger>
                </TabsList>

                <TabsContent value="prob">
                  <div className="mb-3">
                    <SummaryLine
                      chancePercent={chanceWithinOwned}
                      targetText={targetText}
                      stableCostCNY={shoppingPlanP90.totalCostCNY}
                      availablePulls={availablePulls}
                      pullLabel={pullLabel}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="text-xs text-zinc-400">欧皇线（10%）</div>
                      <div className="mt-1 text-xl font-semibold text-zinc-50">{pullsP10} 抽</div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="text-xs text-zinc-400">平均线（50%）</div>
                      <div className="mt-1 text-xl font-semibold text-zinc-50">{pullsP50} 抽</div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="text-xs text-zinc-400">非酋线（90%）</div>
                      <div className="mt-1 text-xl font-semibold text-zinc-50">{pullsP90} 抽</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <ProbChart
                      distribution={simulation.distribution}
                      softPityLabel={softPityLabel}
                      hardPity={pitySystem.hardPity}
                      hardPityLabel={hardPityLabel}
                    />
                  </div>

                  <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200">
                    期望抽数（达到所选张数 UP 五星）：<span className="font-semibold">{formatInt(simulation.expectedValue)}</span> 抽 ·
                    平均线对应{mainCurrencyName}：<span className="font-semibold">{formatInt(new Decimal(pullsP50).mul(costPerPull))}</span>
                    <div className="mt-1 text-xs text-zinc-400">期望抽数 = Σ(抽数 × 达成概率)</div>
                  </div>
                </TabsContent>

                <TabsContent value="benefits">
                  <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div>
                        标称成本：<span className="font-semibold">{costPerPull.toString()}</span> {mainCurrencyName}/
                        {pullLabel}
                      </div>
                      <div>
                        一次性福利：<span className="font-semibold">{oneTimeFreePulls}</span> {pullLabel}
                      </div>
                      <div>
                        累抽福利：<span className="font-semibold">{cumulativeFreePulls}</span> {pullLabel}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      下方用可视化标注该卡池的“累抽/一次性福利”，并展示在福利影响下的“平均每抽实际{mainCurrencyName}”。
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 text-sm font-medium text-zinc-100">福利标注</div>
                      <BannerBenefitsChart benefits={banner?.benefits} />
                    </div>
                    <div>
                      <div className="mb-2 text-sm font-medium text-zinc-100">
                        平均每抽实际{mainCurrencyName}
                      </div>
                      <EffectiveDiamondCostChart
                        costPerPull={costPerPull}
                        benefits={banner?.benefits}
                        maxPaidPulls={maxPaidForChart}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="shop">
                  <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200">
                    距离平均线（50%）还差：
                    <span className="ml-1 font-semibold">{formatInt(needForP50)}</span> {mainCurrencyName}
                  </div>
                  <ShoppingList plan={shoppingPlan} packs={gameConfig.rechargePacks} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
