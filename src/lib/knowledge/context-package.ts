import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { SINGLE_TENANT_USER_ID } from '@/lib/repositories/base'
import type { MemoryCard } from '@/lib/knowledge/types'

export interface ContextPackageResult {
  cards: MemoryCard[]
  tokenEstimate: number
  sources: string[]
}

/**
 * Score a card's relevance to a goal using keyword matching.
 * Keywords longer than 3 characters are extracted from the goal and matched
 * against title, body, and tags of each card.
 */
function scoreCard(card: MemoryCard, keywords: string[]): number {
  if (keywords.length === 0) return 0
  const haystack = [card.title, card.body, ...card.tags].join(' ').toLowerCase()
  return keywords.reduce((score, kw) => score + (haystack.includes(kw) ? 1 : 0), 0)
}

/**
 * Extract keywords from goal text: lowercase words longer than 3 characters.
 */
function extractKeywords(goal: string): string[] {
  return goal
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3)
}

/**
 * Estimate token count for a memory card.
 * Uses a simple heuristic: ceil(charCount / 4).
 */
function estimateTokens(card: MemoryCard): number {
  const text = `${card.title} ${card.body} ${card.tags.join(' ')}`
  return Math.ceil(text.length / 4)
}

/**
 * Builds a compact context package from stored knowledge cards.
 * Used to enrich agent prompts with relevant past learnings.
 * Returns empty result if no relevant cards found — never throws.
 */
export async function buildContextPackage(
  goal: string,
  options?: { workItemId?: string; delegationId?: string; maxCards?: number },
): Promise<ContextPackageResult> {
  const empty: ContextPackageResult = { cards: [], tokenEstimate: 0, sources: [] }

  try {
    const repo = createKnowledgeCardRepository(SINGLE_TENANT_USER_ID)
    const allCards = await repo.listAll()

    if (allCards.length === 0) return empty

    const keywords = extractKeywords(goal)

    const scored = allCards
      .map(card => ({ card, score: scoreCard(card, keywords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)

    const maxCards = options?.maxCards ?? 4
    const topCards = scored.slice(0, maxCards).map(({ card }) => card)

    if (topCards.length === 0) return empty

    const tokenEstimate = topCards.reduce((sum, card) => sum + estimateTokens(card), 0)
    const sources = [...new Set(topCards.flatMap(c => c.sourceIds))]

    return { cards: topCards, tokenEstimate, sources }
  } catch {
    // Non-critical — never throw, always return empty result
    return empty
  }
}
