'use client'

interface Props {
  actualCostUsd?: number
  estimateCostUsd: number
  maxBudgetUsd: number
}

export function computeCostRatio(actual: number | undefined, estimate: number, max: number): number {
  const spent = actual ?? estimate
  if (max <= 0) return 0
  return Math.min(spent / max, 1)
}

export function costBarColor(ratio: number): string {
  if (ratio >= 0.9) return 'bg-red-500'
  if (ratio >= 0.6) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

export function CostMeter({ actualCostUsd, estimateCostUsd, maxBudgetUsd }: Props) {
  const ratio = computeCostRatio(actualCostUsd, estimateCostUsd, maxBudgetUsd)
  const pct = Math.round(ratio * 100)
  const color = costBarColor(ratio)
  const displayCost = actualCostUsd ?? estimateCostUsd
  const isActual = actualCostUsd != null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold font-mono ${isActual ? 'text-yellow-400' : 'text-gray-400'}`}>
          ${displayCost.toFixed(4)}
          {!isActual && <span className="text-gray-600 text-[10px] ml-1">(est.)</span>}
        </span>
        <span className="text-[10px] text-gray-600 font-mono">{pct}%</span>
      </div>
      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-600 font-mono">Budget: ${maxBudgetUsd.toFixed(2)}</span>
    </div>
  )
}
