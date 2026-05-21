export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCards } from '@/lib/knowledge/store'
import type { MemoryCard } from '@/lib/knowledge/types'

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function cardTokenEstimate(card: MemoryCard): number {
  return estimateTokens(`${card.title}\n${card.body}`)
}

/**
 * Score a card's relevance to a goal string.
 * Returns 0 for zero-relevance cards.
 */
function scoreRelevance(card: MemoryCard, goalTerms: string[]): number {
  if (goalTerms.length === 0) return 1

  const titleLower = card.title.toLowerCase()
  const bodyLower = card.body.toLowerCase()

  let score = 0
  for (const term of goalTerms) {
    if (titleLower.includes(term)) score += 10
    if (bodyLower.includes(term)) score += 3
    if (card.tags.some(t => t.toLowerCase().includes(term))) score += 2
  }
  return score
}

interface ContextPackageBody {
  goal: string
  workItemId?: string
  delegationId?: string
  maxCards?: number
}

/**
 * POST /api/knowledge/context-package
 *
 * Body: { goal: string, workItemId?: string, delegationId?: string, maxCards?: number }
 *
 * Response: { contextCards: MemoryCard[], tokenEstimate: number, sources: string[] }
 *
 * Builds a compact context package of relevant memory cards for a given goal.
 * Uses keyword matching. Respects maxCards (default 5) and ~2000 token budget.
 */
export async function POST(req: Request) {
  const body = await req.json() as Partial<ContextPackageBody>

  if (!body.goal?.trim()) {
    return NextResponse.json({ error: 'goal is required' }, { status: 400 })
  }

  const maxCards = Math.min(Math.max(1, body.maxCards ?? 5), 20)
  const MAX_TOKENS = 2000

  const goalTerms = body.goal.toLowerCase().split(/\s+/).filter(t => t.length >= 3)

  const allCards = getCards()

  // Build candidate set: score by goal relevance
  const scored = allCards
    .map(card => ({ card, score: scoreRelevance(card, goalTerms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  // If delegationId provided, boost cards that reference that delegation
  const boostedIds = new Set<string>()
  if (body.delegationId) {
    for (const { card } of scored) {
      if (
        card.sourceIds.includes(body.delegationId) ||
        card.tags.some(t => t.includes(body.delegationId!))
      ) {
        boostedIds.add(card.id)
      }
    }
  }

  // Re-sort with boost for related delegation cards
  const reranked = scored.sort((a, b) => {
    const aBoost = boostedIds.has(a.card.id) ? 1000 : 0
    const bBoost = boostedIds.has(b.card.id) ? 1000 : 0
    return (b.score + bBoost) - (a.score + aBoost)
  })

  // Select cards within token budget
  const contextCards: MemoryCard[] = []
  let totalTokens = 0
  const sources = new Set<string>()

  for (const { card } of reranked) {
    if (contextCards.length >= maxCards) break
    const cardTokens = cardTokenEstimate(card)
    if (totalTokens + cardTokens > MAX_TOKENS && contextCards.length > 0) continue
    contextCards.push(card)
    totalTokens += cardTokens
    card.sourceIds.forEach(s => sources.add(s))
    if (card.projectId) sources.add(card.projectId)
  }

  return NextResponse.json({
    contextCards,
    tokenEstimate: totalTokens,
    sources: Array.from(sources),
  })
}
