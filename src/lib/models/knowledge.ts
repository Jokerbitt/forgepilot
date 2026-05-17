import type { SourceType } from './project-brief'

export type KnowledgePrivacyClass = 'public' | 'internal' | 'sensitive' | 'local-only'
export type KnowledgeItemType =
  | 'document'
  | 'decision'
  | 'requirement'
  | 'use_case'
  | 'risk'
  | 'lesson'
  | 'error'
  | 'agent_run'
  | 'connector_event'

export type MemoryCardType = 'summary' | 'decision' | 'task-context' | 'risk' | 'lesson' | 'source-note'
export type FreshnessStatus = 'fresh' | 'stale' | 'unknown'

export interface KnowledgeSource {
  id: string
  projectId: string
  type: SourceType | 'local_file' | 'agent_log'
  title: string
  urlOrPath: string
  contentHash: string
  privacyClass: KnowledgePrivacyClass
  retrievedAt: string
  updatedAt?: string
  author?: string
}

export interface KnowledgeItem {
  id: string
  projectId: string
  sourceId: string
  type: KnowledgeItemType
  title: string
  summary: string
  contentHash: string
  confidence: 'high' | 'medium' | 'low' | 'uncertain'
  freshness: FreshnessStatus
  tags: string[]
  relatedItemIds: string[]
  createdAt: string
  updatedAt: string
}

export interface MemoryCard {
  id: string
  projectId: string
  type: MemoryCardType
  title: string
  summary: string
  sourceItemIds: string[]
  confidence: 'high' | 'medium' | 'low' | 'uncertain'
  freshness: FreshnessStatus
  tags: string[]
  tokenEstimate: number
  lastReviewedAt?: string
  createdAt: string
  updatedAt: string
}
