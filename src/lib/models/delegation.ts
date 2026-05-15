import type { RiskClass } from './work-item'

export type ExecutionRoute = 'direct-chat' | 'local-agent' | 'runner' | 'n8n' | 'manual'
export type PrivacyMode = 'local' | 'private-cloud' | 'public'
export type DelegationStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TaskContract {
  id: string
  workItemId: string
  goal: string
  context: string
  definitionOfDone: string[]
  riskClass: RiskClass
  maxBudgetUsd: number
  allowedTools: string[]
  branchStrategy: 'feature' | 'fix' | 'chore'
  requiresApproval: boolean
  privacyMode: PrivacyMode
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
  createdAt: string
  updatedAt: string
}
