import { readResearchDocuments } from '@/lib/knowledge/research-store'
import type { SourceCredibility } from '@/lib/models/research'

export interface ResearchStats {
  total: number; completed: number; running: number; failed: number
  totalCitations: number; academicCitations: number; governmentCitations: number
  avgCitationsPerDoc: number; academicRatio: number; totalTokens: number
  topTags: { tag: string; count: number }[]
}

export function computeResearchStats(): ResearchStats {
  const docs = readResearchDocuments()
  const completed = docs.filter(d => d.status === 'completed')
  const citationsByCredibility: Record<SourceCredibility, number> = { academic: 0, government: 0, reputable: 0, general: 0, unknown: 0 }
  let totalCitations = 0, totalTokens = 0
  for (const doc of completed) {
    for (const c of doc.citations) { totalCitations++; citationsByCredibility[c.credibility] = (citationsByCredibility[c.credibility] ?? 0) + 1 }
    if (doc.tokenUsage) totalTokens += doc.tokenUsage.promptTokens + doc.tokenUsage.completionTokens
  }
  const tagCounts = new Map<string, number>()
  for (const doc of docs) for (const tag of doc.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  const topTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count }))
  return {
    total: docs.length, completed: completed.length,
    running: docs.filter(d => d.status === 'running').length,
    failed: docs.filter(d => d.status === 'failed').length,
    totalCitations, academicCitations: citationsByCredibility.academic,
    governmentCitations: citationsByCredibility.government,
    avgCitationsPerDoc: completed.length > 0 ? Math.round(totalCitations / completed.length) : 0,
    academicRatio: totalCitations > 0 ? Math.round(((citationsByCredibility.academic + citationsByCredibility.government) / totalCitations) * 100) / 100 : 0,
    totalTokens, topTags,
  }
}
