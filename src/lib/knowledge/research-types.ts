import type { ResearchDocument } from '@/lib/models/research'

export interface ResearchQualityBreakdown {
  citationCount: number
  academicRatio: number
  officialRatio: number
  sectionCount: number
  keyFindingCount: number
  hasAbstract: boolean
}

export interface ResearchQuality {
  score: number
  breakdown: ResearchQualityBreakdown
  grade: 'A' | 'B' | 'C' | 'D'
}

export interface SearchResult {
  id: string
  title: string
  score: number
  highlights: string[]
  status: ResearchDocument['status']
  completedAt?: string
}
