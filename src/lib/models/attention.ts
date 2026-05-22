export type AttentionSeverity = 'critical' | 'warning' | 'info'

export type AttentionType =
  | 'delegation_completed'
  | 'delegation_failed'
  | 'delegation_stalled'
  | 'budget_exceeded'
  | 'approval_pending'
  | 'escalation'
  | 'system_error'
  | 'review_passed'
  | 'review_failed'
  | 'sla_warning'
  | 'sla_breached'

export interface AttentionItem {
  id: string
  type: AttentionType
  severity: AttentionSeverity
  title: string
  body: string
  delegationId?: string
  actionUrl?: string
  /** Optional context passed by the escalating agent */
  escalationContext?: {
    problem: string
    options?: string[]
    recommendation?: string
  }
  createdAt: string
  resolvedAt?: string
  resolvedBy?: 'user' | 'system'
}

export interface AttentionStore {
  items: AttentionItem[]
  updatedAt: string
}

export interface DigestEntry {
  delegationsCompleted: number
  delegationsFailed: number
  delegationsCancelled: number
  prsCreated: string[]
  totalCostUsd: number
  newKnowledgeCards: number
  openAttentionItems: number
  generatedAt: string
}
