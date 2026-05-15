import type { WorkItem, RiskClass } from './work-item'
import type { ExecutionRoute } from './delegation'

export type SuggestedAction =
  | 'do-now'
  | 'delegate-ai'
  | 'delegate-runner'
  | 'research'
  | 'wait'
  | 'blocked'

export interface NBAScore {
  urgency: number        // 0–25: based on priority + deadline
  impact: number         // 0–25: based on type, project importance
  delegability: number   // 0–25: ai-delegable flag + risk class
  readiness: number      // 0–25: not blocked, has context
  total: number          // 0–100
}

export interface NBARecommendation {
  workItem: WorkItem
  score: NBAScore
  suggestedAction: SuggestedAction
  executionRoute: ExecutionRoute
  riskClass: RiskClass
  estimatedCostUsd?: number
  rationale: string
  risks: string[]
}
