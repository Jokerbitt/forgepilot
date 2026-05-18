export type PrivacyClass = 'public' | 'internal' | 'sensitive' | 'local-only'
export type SourceType = 'nas' | 'markdown' | 'linear' | 'github' | 'agent-run' | 'obsidian' | 'manual'
export type MemoryCardType = 'decision' | 'learning' | 'pattern' | 'risk' | 'requirement' | 'context'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface KnowledgeSource {
  id: string
  type: SourceType
  name: string
  path: string          // file path or URL
  hash: string          // content hash for freshness detection
  privacyClass: PrivacyClass
  lastFetched: string   // ISO date
  freshnessTtlHours: number
  isStale: boolean
  metadata: Record<string, string>
}

export interface KnowledgeItem {
  id: string
  sourceId: string
  title: string
  content: string
  summary: string
  tags: string[]
  privacyClass: PrivacyClass
  confidence: ConfidenceLevel
  tokenEstimate: number
  createdAt: string
  updatedAt: string
}

export interface MemoryCard {
  id: string
  type: MemoryCardType
  title: string
  body: string           // concise, cite-able
  sourceIds: string[]    // links back to KnowledgeItems
  projectId?: string
  tags: string[]
  privacyClass: PrivacyClass
  confidence: ConfidenceLevel
  createdAt: string
  updatedAt: string
}

export interface KnowledgeStore {
  sources: KnowledgeSource[]
  items: KnowledgeItem[]
  cards: MemoryCard[]
}

export interface KnowledgeQuery {
  projectId?: string
  tags?: string[]
  types?: MemoryCardType[]
  maxPrivacyClass?: PrivacyClass
  limit?: number
}

export interface KnowledgeQueryResult {
  cards: MemoryCard[]
  totalCount: number
  query: KnowledgeQuery
}
