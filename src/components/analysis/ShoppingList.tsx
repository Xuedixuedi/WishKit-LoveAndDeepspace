import Decimal from 'decimal.js'

import type { RechargePack } from '@/types/game-config'
import type { ShoppingPlan, ShoppingListItem } from '@/lib/shopping-optimizer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const formatCny = (value: string) => {
  const d = new Decimal(value)
  if (d.lessThan(0)) return '0'
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()
}

const formatInt = (value: string) =>
  new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString()

const isRecommended = (item: ShoppingListItem, pack: RechargePack | undefined) => {
  if (item.isFirstPurchaseVariant) return true
  if (pack?.kind === 'monthly') return true
  return false
}

const recommendedLabel = (item: ShoppingListItem, pack: RechargePack | undefined) => {
  if (pack?.kind === 'monthly') return '超值'
  if (item.isFirstPurchaseVariant) return '推荐'
  return ''
}

export function ShoppingList({
  plan,
  packs
}: {
  plan: ShoppingPlan
  packs: RechargePack[]
}) {
  const packMap = new Map(packs.map((p) => [p.id, p]))
  const totalCost = formatCny(plan.totalCostCNY)

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">预计总花费</CardTitle>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="text-3xl font-semibold tracking-tight text-zinc-50">
            ¥{totalCost}
          </div>
          <div className="text-right text-xs text-zinc-400">
            <div>目标：{formatInt(plan.neededCurrency)} 钻</div>
            <div>
              获得：{formatInt(plan.gainedCurrency)} 钻（溢出 {formatInt(plan.overfillCurrency)}）
            </div>
          </div>
        </div>
        <CardDescription>购买建议基于档位离散优化，优先兼顾“少花钱”和“少溢出”。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {plan.list.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            当前没有可用的购买方案。
          </div>
        ) : (
          <div className="grid gap-2">
            {plan.list.map((item) => {
              const pack = packMap.get(item.packId)
              const tag = recommendedLabel(item, pack)
              const showTag = isRecommended(item, pack)
              return (
                <div
                  key={`${item.packId}-${item.isFirstPurchaseVariant ? 'first' : 'normal'}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-medium text-zinc-100">
                        {item.packName}
                      </div>
                      {showTag ? (
                        <Badge variant={pack?.kind === 'monthly' ? 'gold' : 'purple'}>{tag}</Badge>
                      ) : null}
                      {item.isFirstPurchaseVariant ? (
                        <Badge variant="secondary">首充</Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      获得 {formatInt(item.gainedCurrency)} 钻
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-zinc-100">×{item.count}</div>
                    <div className="text-xs text-zinc-400">¥{formatCny(item.priceCNY)}/次</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

