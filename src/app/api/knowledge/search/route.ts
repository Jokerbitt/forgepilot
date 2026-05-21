export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCards } from '@/lib/knowledge/store'
import type { MemoryCard, MemoryCardType } from '@/lib/knowledge/types'

/**
 * Score a card's relevance against a search query.
 * Title match > body match. Returns 0 if no match.
 */
function scoreCard(card: MemoryCard, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 1

  const titleLower = card.title.toLowerCase()
  const bodyLower = card.body.toLowerCase()

  let score = 0
  for (const term of queryTerms) {
    if (titleLower.includes(term)) score += 10
    if (bodyLower.includes(term)) score += 3
    if (card.tags.some(t => t.toLowerCase().includes(term))) score += 2
  }
  return score
}

/**
 * GET /api/knowledge/search
 *
 * Query params:
 *   q       — search term (keyword-based, case-insensitive)
 *   limit   — max results (default 10)
 *   type    — filter by MemoryCardType (learning | pattern | decision | risk | reference | context | requirement)
 *
 * Response: { cards: MemoryCard[], total: number }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? '10')), 100)
  const typeFilter = searchParams.get('type') as MemoryCardType | null

  const allCards = getCards()

  // Apply type filter
  const typeFiltered = typeFilter
    ? allCards.filter(c => c.type === typeFilter)
    : allCards

  if (!q) {
    // No query: return sorted by createdAt desc, respecting limit + type filter
    const sorted = [...typeFiltered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    return NextResponse.json({ cards: sorted.slice(0, limit), total: sorted.length })
  }

  // Keyword matching
  const queryTerms = q.toLowerCase().split(/\s+/).filter(Boolean)

  const scored = typeFiltered
    .map(card => ({ card, score: scoreCard(card, queryTerms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Tie-break: newer first
      return new Date(b.card.createdAt).getTime() - new Date(a.card.createdAt).getTime()
    })

  return NextResponse.json({
    cards: scored.slice(0, limit).map(({ card }) => card),
    total: scored.length,
  })
}
