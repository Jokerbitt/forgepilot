/**
 * Delegation Cost Tracker — M129
 *
 * Calculates the actual USD cost of a delegation run from token usage
 * and provider pricing. Compares against the contract's maxBudgetUsd
 * and returns budget warnings when the threshold is reached.
 */

import { getAllProviderConfigs } from '@/lib/ai/providers/config-store'

export interface TokenUsageSummary {
  inputTokens: number
  outputTokens: number
  /** Provider ID used for this usage record */
  providerId: string
  /** Model ID used for this usage record */
  modelId: string
}

export interface CostBreakdown {
  inputCostUsd: number
  outputCostUsd: number
  totalCostUsd: number
  providerId: string
  modelId: string
  /** True when pricing data was found in the catalog for this model */
  hasPricingData: boolean
}

export interface BudgetStatus {
  /** Actual cost incurred so far */
  actualCostUsd: number
  /** Maximum allowed spend from TaskContract.maxBudgetUsd */
  maxBudgetUsd: number
  /** 0.0–1.0 ratio of used / allowed (may exceed 1.0) */
  usageRatio: number
  /** Budget has been exceeded */
  exceeded: boolean
  /** Usage is >= 80% of budget (early warning) */
  warning: boolean
  /** Human-readable status message */
  message: string
}

/**
 * Calculate the USD cost for a single AI call.
 *
 * Looks up pricing from the provider catalog; falls back to 0 for
 * providers without pricing data (e.g. Ollama, LM Studio).
 */
export function calculateCallCost(usage: TokenUsageSummary): CostBreakdown {
  const configs = getAllProviderConfigs()
  const config  = configs.find(c => c.id === usage.providerId)
  const model   = config?.models.find(m => m.id === usage.modelId)

  const costPer1kInput  = model?.costPer1kInput  ?? 0
  const costPer1kOutput = model?.costPer1kOutput ?? 0

  const inputCostUsd  = (usage.inputTokens  / 1000) * costPer1kInput
  const outputCostUsd = (usage.outputTokens / 1000) * costPer1kOutput

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    providerId: usage.providerId,
    modelId: usage.modelId,
    hasPricingData: !!model && (costPer1kInput > 0 || costPer1kOutput > 0),
  }
}

/**
 * Sum the cost across multiple calls (e.g. all calls within one delegation run).
 */
export function sumCosts(breakdowns: CostBreakdown[]): number {
  return breakdowns.reduce((total, b) => total + b.totalCostUsd, 0)
}

/**
 * Compare actual spend against the delegation budget and return a status.
 */
export function checkBudget(actualCostUsd: number, maxBudgetUsd: number): BudgetStatus {
  const usageRatio = maxBudgetUsd > 0 ? actualCostUsd / maxBudgetUsd : 0
  const exceeded   = actualCostUsd > maxBudgetUsd && maxBudgetUsd > 0
  const warning    = usageRatio >= 0.8 && !exceeded

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

/**
 * Format a USD amount for display.
 * Under $0.01 → show in milli-cents for readability.
 */
export function formatCostUsd(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.0001) return `< $0.0001`
  if (usd < 0.01)   return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}
