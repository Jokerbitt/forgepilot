/** M132: AI Cost Analytics — shared types for the cost analytics dashboard */

export interface CostAnalytics {
  totals: {
    costUsd: number
    calls: number
    inputTokens: number
    outputTokens: number
    estimatedMonthlyCostUsd: number
  }
  byProvider: Array<{
    providerId: string
    providerName: string
    dataResidency: 'eu' | 'us' | 'local' | 'unknown'
    totalCostUsd: number
    calls: number
    inputTokens: number
    outputTokens: number
  }>
  byPurpose: Array<{
    purpose: string
    totalCostUsd: number
    calls: number
    inputTokens: number
    outputTokens: number
  }>
  dailyTrend: Array<{
    date: string
    totalCostUsd: number
    calls: number
    inputTokens: number
    outputTokens: number
  }>
  budgetUtilization: {
    delegationsWithBudget: number
    delegationsExceeded: number
    utilizationPct: number
  }
}
