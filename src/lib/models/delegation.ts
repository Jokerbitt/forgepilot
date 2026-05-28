import type { RiskClass } from './work-item'

export type ExecutionRoute = 'direct-chat' | 'local-agent' | 'runner' | 'ollama-agent' | 'n8n' | 'manual'
export type PrivacyMode = 'local' | 'private-cloud' | 'public'
export type OutputMode = 'text' | 'json' | 'stream'
export type DelegationStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled' | 'rejected'

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
  /** Token breakdown (legacy format) */
  tokensUsed: TokenUsage
  /** Legacy field name — prefer cloudEquivalentUsd */
  claudeEquivalentUsd: number
  /** Actual cost (0 for Ollama) */
  actualCostUsd: number
  /** Money saved by running locally */
  savedUsd: number
  /** Which model ran locally */
  localModel: string
  /** M159: cloud-equivalent cost — newer name for claudeEquivalentUsd */
  cloudEquivalentUsd?: number
  /** M159: input token count — newer alternative to tokensUsed.promptTokens */
  inputTokens?: number
  /** M159: output token count — newer alternative to tokensUsed.completionTokens */
  outputTokens?: number
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
  // PR lifecycle tracking (M264)
  prState?: 'open' | 'merged' | 'closed'
  prMergedAt?: string
  /** G1: true when this report was produced by the API plan-only fallback (no code was written) */
  planOnly?: boolean
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
  /** M209: If set, execution pauses when actualCostUsd exceeds this value */
  maxCostUsd?: number
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
  /** M206: If true, auto-approve and execute the next chained delegation when this completes */
  autoChain?: boolean
  /** G2: If true, automatically queue a retry delegation when critic score < 70 */
  autoRetryOnCriticFail?: boolean
  /** Context profile used for this delegation (from context-router.ts) */
  contextProfile?: string
  createdAt: string
  // Expert Mode Policy Fields (#19)
  llmProvider?: string
  toolPolicy?: 'all' | 'code-read' | 'code-write' | 'web-search' | 'restricted' | 'custom'
  toolAllowList?: string[]
  toolDenyList?: string[]
  outputPolicy?: 'pr' | 'writeback' | 'pr-and-writeback' | 'none'
  approvalMode?: 'auto' | 'manual' | 'skip'
  approvalThreshold?: number
  writeScope?: string[]
  executionRoute?: string
}

/** M181: Grok Critic result stored after successful execution */
export interface CriticScore {
  correctness: number   // 0-100
  efficiency: number    // 0-100
  drift: number         // 0-100 (lower = more drift)
  verdict: 'approved' | 'needs-revision' | 'rejected'
  summary: string
  runAt: string         // ISO timestamp
}

/** M230: Configuration for automatically chaining a follow-up delegation on completion */
export interface ChainConfig {
  /** Title for the next delegation */
  nextTitle: string
  /** What the next delegation should do */
  nextPrompt: string
  /** true = auto-execute immediately, false = create as pending */
  autoStart: boolean
  /** Whether to pass the last 500 chars of execution output as context */
  passOutputAs?: 'context' | 'none'
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
  /** When true, execute route auto-orchestrates into sub-tasks */
  autoOrchestrate?: boolean
  /** M164: OpenTelemetry trace ID for this delegation execution */
  traceId?: string
  /** M181: Grok Critic score — automatically populated after successful execution */
  criticScore?: CriticScore
  /** M206: ID of the next delegation to trigger after this one completes */
  chainNextId?: string
  /** M206: ID of the delegation that triggered this one */
  chainPrevId?: string
  /** M206: Position in the chain (1-based) */
  chainPosition?: number
  /** M206: Total number of steps in the chain */
  chainTotal?: number
  /** M230: Configuration for chaining to a new delegation on completion */
  chainConfig?: ChainConfig
  /** M230: ID of the delegation that triggered this one (populated by chaining) */
  chainedFromId?: string
  /** M230: ID of the delegation this one created via chaining */
  chainedDelegationId?: string
  /** M207: ID of parent delegation (for sub-delegations in parallel fan-out) */
  parentId?: string
  /** M207: IDs of spawned child sub-delegations */
  childIds?: string[]
  /** M207: Group identifier shared by all parallel sub-delegations from the same fan-out */
  parallelGroup?: string
  /** M233: ISO timestamp when execution started (status → running) */
  startedAt?: string
  /** M233: ISO timestamp when execution reached a terminal state */
  completedAt?: string
  /** M234: User-defined tags for categorization and filtering */
  tags?: string[]
  /** M241: Number of times this delegation has been retried */
  retryCount?: number
  /** M305: Snapshot of MemoryCards used when building the context package for execution */
  contextSnapshot?: {
    cards: Array<{ id: string; title: string; type: string; tags: string[] }>
    tokenEstimate: number
    builtAt: string
  }
  /** Target GitHub repo URL for the agent to work against (overrides ForgePilot's own repo) */
  targetRepo?: string
  /** Auto-generated DoD quality check result after execution */
  qualityCheck?: DoDQualityCheck
  createdAt: string
  updatedAt: string
}

export interface DoDCriterion {
  item: string
  met: boolean
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

export interface DoDQualityCheck {
  criteria: DoDCriterion[]
  overallScore: number   // 0-100
  verdict: 'passed' | 'partial' | 'failed'
  suggestion?: string    // natural-language retry hint if not passed
  checkedAt: string
}
