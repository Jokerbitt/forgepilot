export type ResearchStatus = 'pending' | 'running' | 'completed' | 'failed'
export type SourceCredibility = 'academic' | 'government' | 'reputable' | 'general' | 'unknown'

export interface ResearchCitation {
  id: string
  title: string
  url: string
  author?: string
  publishedAt?: string
  credibility: SourceCredibility
  excerpt: string
}

export interface ResearchSection {
  heading: string
  content: string
  citations: string[]  // citation IDs
}

export interface ResearchDocument {
  id: string
  topic: string
  question?: string
  status: ResearchStatus
  abstract?: string
  keyFindings: string[]
  sections: ResearchSection[]
  citations: ResearchCitation[]
  tags: string[]
  relatedWorkItemId?: string
  relatedProjectBriefId?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  model?: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
  }
}
