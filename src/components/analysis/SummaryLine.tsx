import Decimal from 'decimal.js'

export function SummaryLine({
  chancePercent,
  targetText,
  stableCostCNY,
  availablePulls,
  pullLabel
}: {
  chancePercent: Decimal.Value
  targetText: string
  stableCostCNY: Decimal.Value
  availablePulls: number
  pullLabel: string
}) {
  const pct = Decimal.min(Decimal.max(new Decimal(chancePercent), 0), 100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toString()
  const cost = Decimal.max(new Decimal(stableCostCNY), 0)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toString()

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200">
      当前资源约可抽 <span className="font-semibold text-amber-200">{availablePulls}</span> {pullLabel}，
      拿下<span className="font-semibold text-zinc-50"> {targetText}</span>的概率约
      <span className="font-semibold text-amber-200"> {pct}%</span>。
      {new Decimal(cost).greaterThan(0) ? (
        <>
          {' '}如果想稳拿（90%），建议补充{' '}
          <span className="font-semibold text-purple-200">¥{cost}</span> 的礼包。
        </>
      ) : (
        <> 当前资源已达到稳拿（≥90%）水平。</>
      )}
    </div>
  )
}
