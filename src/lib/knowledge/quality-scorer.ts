import type { ResearchDocument } from '@/lib/models/research'
import type { ResearchQuality } from './research-types'

export type { ResearchQuality }
export type { ResearchQualityBreakdown } from './research-types'

export function computeQuality(doc: ResearchDocument): ResearchQuality {
  const citationCount = doc.citations.length
  const academicCount = doc.citations.filter(c => c.credibility === 'academic').length
  const officialCount = doc.citations.filter(c => c.credibility === 'government').length
  const academicRatio = citationCount > 0 ? academicCount / citationCount : 0
  const officialRatio = citationCount > 0 ? officialCount / citationCount : 0
  const sectionCount = doc.sections.length
  const keyFindingCount = doc.keyFindings.length
  const hasAbstract = Boolean(doc.abstract && doc.abstract.trim().length > 0)
  let score = 0
  if (citationCount >= 8) score += 25
  else if (citationCount >= 4) score += 15
  else if (citationCount >= 1) score += 5
  if (academicRatio >= 0.3) score += 25
  else if (academicRatio >= 0.1) score += 15
  if (sectionCount >= 4) score += 20
  else if (sectionCount >= 2) score += 10
  if (keyFindingCount >= 5) score += 15
  else if (keyFindingCount >= 3) score += 8
  if (hasAbstract) score += 15
  const grade: ResearchQuality['grade'] =
    score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'
  return { score, breakdown: { citationCount, academicRatio, officialRatio, sectionCount, keyFindingCount, hasAbstract }, grade }
}
