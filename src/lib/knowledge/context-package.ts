import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { SINGLE_TENANT_USER_ID } from '@/lib/repositories/base'
import type { MemoryCard } from '@/lib/knowledge/types'
import { withSpan } from '@/lib/tracing/tracer'
import { getCardWithRelated } from './graph'

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
    return await withSpan(
      'context.build',
      { goal: goal.slice(0, 80) },
      async (span) => {
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

        // Expand top cards with their related cards (1 level deep)
        const topIds = new Set(top.map(c => c.id))
        const expandedCards: MemoryCard[] = [...top]

        try {
          const expansions = await Promise.allSettled(
            top.map(c => getCardWithRelated(c.id))
          )
          for (const exp of expansions) {
            if (exp.status !== 'fulfilled') continue
            for (const related of exp.value) {
              if (!topIds.has(related.id)) {
                // Find the full MemoryCard for the related card (already fetched by repo)
                const relatedCard = allCards.find(c => c.id === related.id)
                if (relatedCard) {
                  topIds.add(relatedCard.id)
                  expandedCards.push(relatedCard)
                }
              }
            }
          }
        } catch {
          // silently skip — original top cards are always returned
        }

        const tokenEstimate = expandedCards.reduce((acc, c) => acc + Math.ceil((c.title.length + c.body.length) / 4), 0)
        const sources = [...new Set(expandedCards.flatMap(c => c.sourceIds).filter(Boolean))]

        span.setAttribute('context.cards_found', expandedCards.length)
        span.setAttribute('context.token_estimate', tokenEstimate)

        return { cards: expandedCards, tokenEstimate, sources }
      }
    )
  } catch {
    return { cards: [], tokenEstimate: 0, sources: [] }
  }
}
