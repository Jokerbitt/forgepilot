import type { RiskClass } from './work-item'

export type ContextPackageStatus = 'draft' | 'ready' | 'approved' | 'expired'
export type ContextPrivacyMode = 'local-only' | 'hybrid' | 'cloud-approved'

export interface ContextReference {
  id: string
  type: 'file' | 'memory_card' | 'knowledge_item' | 'adr' | 'linear_issue' | 'github_item'
  title: string
  urlOrPath: string
  relevanceScore: number
  tokenEstimate: number
}

export interface ContextPackage {
  id: string
  projectId: string
  workItemId: string
  status: ContextPackageStatus
  goal: string
  summary: string
  references: ContextReference[]
  constraints: string[]
  risks: string[]
  allowedTools: string[]
  forbiddenActions: string[]
  privacyMode: ContextPrivacyMode
  riskClass: RiskClass
  tokenBudget: number
  tokenEstimate: number
  redacted: boolean
  createdAt: string
  expiresAt?: string
}
