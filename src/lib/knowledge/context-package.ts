import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { SINGLE_TENANT_USER_ID } from '@/lib/repositories/base'
import type { MemoryCard } from '@/lib/knowledge/types'

export interface ContextPackageResult {
  cards: MemoryCard[]
  tokenEstimate: number
  sources: string[]
}

/**
 * Builds a compact context package from stored knowledge cards.
 * Scores cards by keyword overlap with the goal string.
 * Never throws — returns empty result on error.
 */
export async function buildContextPackage(
  goal: string,
  options?: { workItemId?: string; delegationId?: string; maxCards?: number }
): Promise<ContextPackageResult> {
  try {
    const repo = createKnowledgeCardRepository(SINGLE_TENANT_USER_ID)
    const allCards = await repo.listAll()
    if (!allCards.length) return { cards: [], tokenEstimate: 0, sources: [] }

    // Keyword scoring
    const words = goal.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const scored = allCards.map(card => {
      const text = `${card.title} ${card.body} ${(card.tags ?? []).join(' ')}`.toLowerCase()
      const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0)
      return { card, score }
    })

    const maxCards = options?.maxCards ?? 4
    const top = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCards)
      .map(s => s.card)

    const tokenEstimate = top.reduce((acc, c) => acc + Math.ceil((c.title.length + c.body.length) / 4), 0)
    const sources = [...new Set(top.flatMap(c => c.sourceIds).filter(Boolean))]

    return { cards: top, tokenEstimate, sources }
  } catch {
    return { cards: [], tokenEstimate: 0, sources: [] }
  }
}
