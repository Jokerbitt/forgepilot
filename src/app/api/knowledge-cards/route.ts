export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  readKnowledgeCards,
  findKnowledgeCardsBySource,
  searchKnowledgeCards,
  writeKnowledgeCard,
} from '@/lib/knowledge/knowledge-card'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { logAuditEvent } from '@/lib/audit'

const CreateKnowledgeCardSchema = z.object({
  title:    z.string().min(1).max(200),
  content:  z.string().min(1).max(10_000),
  sourceId: z.string().min(1),
  briefId:  z.string().optional(),
  prUrl:    z.string().optional(),
  tags:     z.array(z.string().max(50)).max(10).default([]),
})

/**
 * GET /api/knowledge-cards
 * Returns all KnowledgeCards sorted by createdAt descending.
 *
 * Query params:
 *   ?sourceId=xxx — filter by delegation source id
 *   ?q=xxx        — full-text search across title, content and tags
 */
export async function GET(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const sourceId = searchParams.get('sourceId')
  const q        = searchParams.get('q')?.trim() ?? ''

  let cards = sourceId
    ? findKnowledgeCardsBySource(sourceId)
    : q
      ? searchKnowledgeCards(q)           // returns already relevance-sorted
      : readKnowledgeCards()

  // Sort descending by createdAt when no search-rank ordering
  if (!q) {
    cards = [...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  return NextResponse.json({ cards, total: cards.length })
}

/**
 * POST /api/knowledge-cards
 * Manually create a knowledge card linked to a delegation.
 */
export async function POST(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const body = await parseBody(request, CreateKnowledgeCardSchema)
  if (isValidationError(body)) return body

  const card = writeKnowledgeCard({
    title:    body.title,
    content:  body.content,
    source:   'delegation',
    sourceId: body.sourceId,
    briefId:  body.briefId,
    prUrl:    body.prUrl,
    tags:     body.tags,
  })

  logAuditEvent({
    action:      'knowledge_card.created',
    entityId:    card.id,
    entityType:  'knowledge_card',
    entityTitle: card.title,
    actor:       'user',
    metadata:    { sourceId: card.sourceId },
  })

  return NextResponse.json(card, { status: 201 })
}
