export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { readKnowledgeCards, findKnowledgeCardsBySource } from '@/lib/knowledge/knowledge-card'

/**
 * GET /api/knowledge-cards
 * Returns all KnowledgeCards sorted by createdAt descending.
 *
 * Query params:
 *   ?sourceId=xxx — filter by delegation source id
 */
export async function GET(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const sourceId = searchParams.get('sourceId')

  const cards = sourceId
    ? findKnowledgeCardsBySource(sourceId)
    : readKnowledgeCards()

  // Sort descending by createdAt
  const sorted = [...cards].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  )

  return NextResponse.json({ cards: sorted, total: sorted.length })
}
