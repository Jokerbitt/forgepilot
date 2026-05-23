export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCards } from '@/lib/knowledge/store'
import { readKnowledgeCards } from '@/lib/knowledge/knowledge-card'
import type { MemoryCard, MemoryCardType } from '@/lib/knowledge/types'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'

// M308: unified search result — normalised shape for both stores
export interface UnifiedSearchResult {
  id: string
  title: string
  body: string
  type: string
  tags: string[]
  source: 'memory' | 'lesson'
  /** ISO timestamp */
  createdAt: string
  /** delegation or brief link */
  sourceId?: string
  /** PR URL when available */
  prUrl?: string
}

function scoreMemoryCard(card: MemoryCard, queryTerms: string[]): number {
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

function scoreKnowledgeCard(card: KnowledgeCard, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 1
  const titleLower = card.title.toLowerCase()
  const contentLower = card.content.toLowerCase()
  let score = 0
  for (const term of queryTerms) {
    if (titleLower.includes(term)) score += 10
    if (contentLower.includes(term)) score += 3
    if (card.tags.some(t => t.toLowerCase().includes(term))) score += 2
  }
  return score
}

function memoryCardToResult(card: MemoryCard): UnifiedSearchResult {
  return {
    id: card.id,
    title: card.title,
    body: card.body,
    type: card.type,
    tags: card.tags,
    source: 'memory',
    createdAt: card.createdAt,
  }
}

function knowledgeCardToResult(card: KnowledgeCard): UnifiedSearchResult {
  return {
    id: card.id,
    title: card.title,
    body: card.content.slice(0, 500),
    type: 'learning',
    tags: card.tags,
    source: 'lesson',
    createdAt: card.createdAt,
    sourceId: card.sourceId,
    prUrl: card.prUrl,
  }
}

/**
 * GET /api/knowledge/search
 *
 * Query params:
 *   q       — search term (keyword-based, case-insensitive)
 *   limit   — max results (default 10, max 100)
 *   type    — filter by MemoryCardType or 'lesson' to restrict to KnowledgeCards
 *   store   — 'memory' | 'lesson' | 'all' (default 'all') — M308 unified search
 *
 * Response: { results: UnifiedSearchResult[], total: number }
 *           Also includes legacy `cards` field for backward compatibility.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? '10')), 100)
  const typeFilter = searchParams.get('type') as MemoryCardType | 'lesson' | null
  const storeFilter = (searchParams.get('store') ?? 'all') as 'memory' | 'lesson' | 'all'

  const queryTerms = q.toLowerCase().split(/\s+/).filter(Boolean)

  const includeMemory = storeFilter === 'all' || storeFilter === 'memory'
  const MEMORY_ONLY_TYPES: Array<string> = ['context', 'pattern', 'decision', 'risk', 'requirement']
  const includeLessons =
    (storeFilter === 'all' || storeFilter === 'lesson') &&
    (typeFilter === null || typeFilter === 'learning' || typeFilter === 'lesson' || !MEMORY_ONLY_TYPES.includes(typeFilter))

  const results: Array<{ result: UnifiedSearchResult; score: number }> = []

  // Search MemoryCards (NAS-indexed)
  if (includeMemory) {
    const allCards = getCards()
    const typeFiltered = typeFilter && typeFilter !== 'lesson'
      ? allCards.filter(c => c.type === typeFilter)
      : allCards

    for (const card of typeFiltered) {
      const score = scoreMemoryCard(card, queryTerms)
      if (!q || score > 0) {
        results.push({ result: memoryCardToResult(card), score })
      }
    }
  }

  // Search KnowledgeCards (delegation lessons)
  if (includeLessons) {
    const lessons = readKnowledgeCards()
    for (const card of lessons) {
      const score = scoreKnowledgeCard(card, queryTerms)
      if (!q || score > 0) {
        results.push({ result: knowledgeCardToResult(card), score })
      }
    }
  }

  // Sort: by score desc, then by createdAt desc
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.result.createdAt).getTime() - new Date(a.result.createdAt).getTime()
  })

  const paged = results.slice(0, limit).map(r => r.result)

  return NextResponse.json({
    results: paged,
    total: results.length,
    // Legacy compatibility: cards returns memory-only MemoryCard shape
    cards: paged.filter(r => r.source === 'memory'),
  })
}
