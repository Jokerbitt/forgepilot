export type CostPeriod = 'today' | 'week' | 'month'
export type CostCategory = 'runner' | 'direct-chat' | 'local-agent' | 'n8n' | 'external-api'

export interface CostEntry {
  id: string
  agentRunId?: string
  delegationId?: string
  category: CostCategory
  model?: string
  tokenInput: number
  tokenOutput: number
  amountUsd: number
  timestamp: string
  description?: string
}

export interface CostBudget {
  dailyLimitUsd: number
  weeklyLimitUsd: number
  monthlyLimitUsd: number
  alertThresholdPercent: number
}

export interface CostSummary {
  period: CostPeriod
  totalUsd: number
  byCategory: Record<CostCategory, number>
  budget?: CostBudget
  budgetUsedPercent?: number
  entries: CostEntry[]
}
