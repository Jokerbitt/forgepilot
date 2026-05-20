export interface BudgetStatus {
  actualCostUsd: number
  maxBudgetUsd: number
  usageRatio: number
  exceeded: boolean
  warning: boolean
  message: string
}

export function checkBudget(actualCostUsd: number, maxBudgetUsd: number): BudgetStatus {
  const usageRatio = maxBudgetUsd > 0 ? actualCostUsd / maxBudgetUsd : 0
  const exceeded = actualCostUsd > maxBudgetUsd && maxBudgetUsd > 0
  const warning = usageRatio >= 0.8 && !exceeded

  let message: string
  if (maxBudgetUsd <= 0) {
    message = 'No budget set'
  } else if (exceeded) {
    const pct = Math.round(usageRatio * 100)
    message = `Budget exceeded: $${actualCostUsd.toFixed(4)} / $${maxBudgetUsd.toFixed(2)} (${pct}%)`
  } else if (warning) {
    const pct = Math.round(usageRatio * 100)
    message = `Budget warning: ${pct}% used ($${actualCostUsd.toFixed(4)} / $${maxBudgetUsd.toFixed(2)})`
  } else {
    const pct = Math.round(usageRatio * 100)
    message = `$${actualCostUsd.toFixed(4)} / $${maxBudgetUsd.toFixed(2)} (${pct}%)`
  }

  return { actualCostUsd, maxBudgetUsd, usageRatio, exceeded, warning, message }
}

export function formatCostUsd(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.0001) return '< $0.0001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}
