import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { SINGLE_TENANT_USER_ID } from '@/lib/repositories/base'
import type { MemoryCard } from '@/lib/knowledge/types'
import { withSpan } from '@/lib/tracing/tracer'
import { getCardWithRelated } from './graph'
import { readKnowledgeCards } from './knowledge-card'
import type { KnowledgeCard } from './knowledge-card'

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

        // M303: include KnowledgeCards (delegation lessons) as synthetic MemoryCards
        // These have a 1.5× boost because they are verified lessons from real executions
        const lessonCards: MemoryCard[] = readKnowledgeCards().map((kc: KnowledgeCard) => ({
          id:         `kc:${kc.id}`,
          title:      kc.title,
          body:       kc.content,
          type:       'learning' as const,
          tags:       ['delegation-lesson', ...kc.tags],
          sourceIds:  [kc.sourceId],
          confidence: 'high' as const,
          privacyClass: 'internal' as const,
          createdAt:  kc.createdAt,
          updatedAt:  kc.updatedAt,
        }))

        const combined = [...allCards, ...lessonCards]
        if (!combined.length) return { cards: [], tokenEstimate: 0, sources: [] }

        // M288: TF-IDF-like scoring with title/tag boost and bigrams
        const tokens = goal.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        const bigrams = tokens.slice(0, -1).map((w, i) => `${w} ${tokens[i + 1]}`)
        const allTerms = [...tokens, ...bigrams]

        const scored = combined.map(card => {
          const titleLow = card.title.toLowerCase()
          const bodyLow  = card.body.toLowerCase()
          const tagsJoin = (card.tags ?? []).join(' ').toLowerCase()

          let score = 0
          for (const term of allTerms) {
            // count occurrences in body (1 pt each)
            const bodyCount = (bodyLow.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
            score += bodyCount

            // title match: 3× weight
            if (titleLow.includes(term)) score += 3

            // tag exact match: 2× weight (normalized comparison)
            if (tagsJoin.includes(term)) score += 2
          }
          return { card, score }
        })

        const maxCards = options?.maxCards ?? 4
        // Dedup by origin (source delegation/item): a single run produces several
        // cards (extraction / Report: / Execution: …) that all match the same
        // query, so without dedup the prompt gets 3 variants of ONE run instead of
        // lessons from 3 different runs. Keep the highest-scored card per source →
        // more diverse lessons + fewer tokens.
        const seenSources = new Set<string>()
        const top = scored
          .filter(s => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .filter(s => {
            const key = s.card.sourceIds?.[0] ?? s.card.id
            if (seenSources.has(key)) return false
            seenSources.add(key)
            return true
          })
          .slice(0, maxCards)
          .map(s => s.card)

        // Expand top cards with their related cards (1 level deep)
        // Only expand MemoryCards (not synthetic lesson cards) — lesson cards have no graph edges
        const topIds = new Set(top.map(c => c.id))
        const expandedCards: MemoryCard[] = [...top]

        try {
          const expandable = top.filter(c => !c.id.startsWith('kc:'))
          const expansions = await Promise.allSettled(
            expandable.map(c => getCardWithRelated(c.id))
          )
          for (const exp of expansions) {
            if (exp.status !== 'fulfilled') continue
            for (const related of exp.value) {
              if (!topIds.has(related.id)) {
                // Find the full MemoryCard for the related card (already fetched by repo)
                const relatedCard = combined.find(c => c.id === related.id)
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
