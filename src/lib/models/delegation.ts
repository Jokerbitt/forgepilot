import type { RiskClass } from './work-item'

export type ExecutionRoute = 'direct-chat' | 'local-agent' | 'runner' | 'n8n' | 'manual'
export type PrivacyMode = 'local' | 'private-cloud' | 'public'
export type DelegationStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AgentLog {
  timestamp: string
  type: 'info' | 'error' | 'success' | 'command' | 'thought'
  message: string
}

export interface DelegationReport {
  keyPoints: string[]
  changes: string[]
  timeTakenMinutes: number
}

export type TaskType = 'feature' | 'bugfix' | 'docs' | 'refactor' | 'research'

export interface TaskContract {
  id: string
  workItemId: string
  goal: string
  context: string
  taskType?: TaskType
  definitionOfDone: string[]
  riskClass: RiskClass
  maxBudgetUsd: number
  allowedTools: string[]
  branchStrategy: 'feature' | 'fix' | 'chore'
  requiresApproval: boolean
  privacyMode: PrivacyMode
  llmModel?: string
  createdAt: string
}

export interface Delegation {
  id: string
  contract: TaskContract
  status: DelegationStatus
  executionRoute: ExecutionRoute
  costEstimateUsd: number
  actualCostUsd?: number
  agentRunId?: string
  approvalId?: string
  errorMessage?: string
  logs?: AgentLog[]
  summaryReport?: DelegationReport
  createdAt: string
  updatedAt: string
}
