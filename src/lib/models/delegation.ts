import type { RiskClass } from './work-item'

export type ExecutionRoute = 'direct-chat' | 'local-agent' | 'runner' | 'ollama-agent' | 'n8n' | 'manual'
export type PrivacyMode = 'local' | 'private-cloud' | 'public'
export type OutputMode = 'text' | 'json' | 'stream'
export type DelegationStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AgentLog {
  timestamp: string
  type: 'info' | 'error' | 'success' | 'command' | 'thought'
  message: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface CostSavings {
  tokensUsed: TokenUsage
  /** What Claude Sonnet would have cost for the same tokens */
  claudeEquivalentUsd: number
  /** Actual cost (0 for Ollama) */
  actualCostUsd: number
  /** Money saved by running locally */
  savedUsd: number
  /** Which model ran locally */
  localModel: string
}

export interface DelegationReport {
  keyPoints: string[]
  changes: string[]        // legacy — bleibt für Rückwärtskompatibilität
  timeTakenMinutes: number
  // Erweitertes Report-Modell (JOK-64)
  filesAdded?: string[]
  filesModified?: string[]
  filesDeleted?: string[]
  testsAdded?: number
  testsPassed?: number
  linesAdded?: number
  linesRemoved?: number
  prUrl?: string
  branchName?: string
  commitMessages?: string[]
  warnings?: string[]
  nextSuggestions?: string[]
  // Token tracking (M27)
  costSavings?: CostSavings
}

export interface DelegationNote {
  text: string
  updatedAt: string
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
  outputMode?: OutputMode
  /** Skill category — set by orchestrator for targeted prompting */
  skillCategory?: 'api-route' | 'ui-component' | 'data-model' | 'test' | 'refactor' | 'infrastructure' | 'documentation'
  /** File patterns this task is allowed to touch */
  allowedFilePatterns?: string[]
  /** Parent orchestrated run ID — set when created by orchestrator */
  orchestratedRunId?: string
  createdAt: string
}

export interface Delegation {
  id: string
  title: string
  contract: TaskContract
  status: DelegationStatus
  executionRoute: ExecutionRoute
  costEstimateUsd: number
  actualCostUsd?: number
  agentRunId?: string
  approvalId?: string
  priority?: number
  briefId?: string
  briefTitle?: string
  errorMessage?: string
  failureFeedback?: string
  logs?: AgentLog[]
  summaryReport?: DelegationReport
  note?: DelegationNote
  createdAt: string
  updatedAt: string
}
