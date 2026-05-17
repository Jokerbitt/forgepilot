import type { PrivacyClass } from '@/lib/knowledge/types'

export type ContextPrivacyMode = 'local-only' | 'hybrid' | 'cloud-approved'

export interface ContextSource {
  sourceId: string
  label: string
  tokenCount: number
  privacyClass: PrivacyClass
  included: boolean
  excludedReason?: string
}

export interface ContextPackage {
  id: string
  workItemId: string
  projectId?: string
  title: string
  objective: string         // what the agent needs to accomplish
  privacyMode: ContextPrivacyMode
  sources: ContextSource[]
  memoryCardIds: string[]
  content: string           // assembled, token-compressed context
  tokenCount: number
  tokenBudget: number
  readinessScore: number    // 0–100: how complete the context is
  blockers: string[]        // missing info that would improve context
  createdAt: string
  expiresAt: string
}

export interface BuildContextPackageInput {
  workItemId: string
  projectId?: string
  title: string
  objective: string
  privacyMode?: ContextPrivacyMode
  tokenBudget?: number
  tags?: string[]
}

export interface BuildContextPackageResult {
  package: ContextPackage
  warnings: string[]
}
