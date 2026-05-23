export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  findKnowledgeCardById,
  deleteKnowledgeCard,
} from '@/lib/knowledge/knowledge-card'
import { logAuditEvent } from '@/lib/audit'

/**
 * GET /api/knowledge-cards/[id]
 * Returns a single KnowledgeCard by id.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const card = findKnowledgeCardById(id)
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(card)
}

/**
 * DELETE /api/knowledge-cards/[id]
 * Permanently removes a KnowledgeCard from the store.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const deleted = deleteKnowledgeCard(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  logAuditEvent({
    action:      'knowledge_card.deleted',
    entityId:    deleted.id,
    entityType:  'knowledge_card',
    entityTitle: deleted.title,
    actor:       'user',
    metadata:    { sourceId: deleted.sourceId },
  })

  return NextResponse.json({ success: true, deleted: deleted.id })
}
