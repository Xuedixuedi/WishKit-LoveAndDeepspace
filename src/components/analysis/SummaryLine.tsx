import Decimal from 'decimal.js'

export function SummaryLine({
  chancePercent,
  targetText,
  stableCostCNY
}: {
  chancePercent: Decimal.Value
  targetText: string
  stableCostCNY: Decimal.Value
}) {
  const pct = Decimal.min(Decimal.max(new Decimal(chancePercent), 0), 100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toString()
  const cost = Decimal.max(new Decimal(stableCostCNY), 0)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toString()

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200">
      以你当前的资源，有 <span className="font-semibold text-amber-200">{pct}%</span> 的概率拿下
      <span className="font-semibold text-zinc-50"> {targetText}</span>。
      {new Decimal(cost).greaterThan(0) ? (
        <>
          {' '}如果想稳拿（90%），建议补充{' '}
          <span className="font-semibold text-purple-200">¥{cost}</span> 的礼包。
        </>
      ) : (
        <> 如果想稳拿（90%），当前资源已足够。</>
      )}
    </div>
  )
}
