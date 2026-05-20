/**
 * Delegation Cost Tracker — M129
 *
 * Calculates the actual USD cost of a delegation run from token usage
 * and provider pricing. Compares against the contract's maxBudgetUsd
 * and returns budget warnings when the threshold is reached.
 */

import { getAllProviderConfigs } from '@/lib/ai/providers/config-store'
export { checkBudget, formatCostUsd } from './cost-format'
export type { BudgetStatus } from './cost-format'

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
