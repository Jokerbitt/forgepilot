export type WorkItemSource = 'linear' | 'github'
export type WorkItemType = 'ticket' | 'pr' | 'issue' | 'ci-alert'
export type WorkItemStatus = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done' | 'cancelled'
export type RiskClass = 'A' | 'B' | 'C'

export interface WorkItem {
  id: string
  source: WorkItemSource
  type: WorkItemType
  title: string
  url: string
  projectId: string
  status: WorkItemStatus
  /** 0 = urgent, 1 = high, 2 = medium, 3 = low, 4 = none */
  priority: 0 | 1 | 2 | 3 | 4
  blocked: boolean
  blockedBy?: string[]
  risk: RiskClass
  aiDelegable: boolean
  estimatedMinutes?: number
  costEstimateUsd?: number
  labels?: string[]
  assigneeId?: string
  assigneeName?: string
  assigneeAvatarUrl?: string
  estimate?: number
  updatedAt: string
  createdAt: string
}
