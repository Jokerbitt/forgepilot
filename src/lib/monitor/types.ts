export interface AgentActivity {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'idle'
  provider: string
  model: string
  purpose: 'fast' | 'coding'
  task?: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
  runId?: string
}

export interface ProviderStats {
  providerId: string
  providerName: string
  model: string
  callsToday: number
  callsTotal: number
  tokensToday: number
  tokensTotal: number
  costTodayUsd: number
  costTotalUsd: number
  avgLatencyMs: number
  errorRate: number
  freeQuotaUsed?: number
  freeQuotaLimit?: number
}

export interface MonitorRecommendation {
  type: 'cost' | 'speed' | 'quota' | 'error' | 'switch_model'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  action?: string
}

export interface MonitorSnapshot {
  timestamp: string
  activeAgents: AgentActivity[]
  recentAgents: AgentActivity[]
  providerStats: ProviderStats[]
  recommendations: MonitorRecommendation[]
  totals: {
    tokensToday: number
    costTodayUsd: number
    costThisMonthUsd: number
    callsToday: number
    avgResponseMs: number
    successRate: number
  }
}
