export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  findKnowledgeCardById,
  deleteKnowledgeCard,
  updateKnowledgeCard,
} from '@/lib/knowledge/knowledge-card'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { logAuditEvent } from '@/lib/audit'

const PatchKnowledgeCardSchema = z.object({
  title:   z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10_000).optional(),
  tags:    z.array(z.string().max(50)).max(10).optional(),
  prUrl:   z.string().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'At least one field must be provided',
})

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
 * PATCH /api/knowledge-cards/[id]
 * Partially update a KnowledgeCard (title, content, tags, prUrl).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const existing = findKnowledgeCardById(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await parseBody(request, PatchKnowledgeCardSchema)
  if (isValidationError(body)) return body

  const updated = updateKnowledgeCard(id, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  logAuditEvent({
    action:      'knowledge_card.updated',
    entityId:    updated.id,
    entityType:  'knowledge_card',
    entityTitle: updated.title,
    actor:       'user',
    metadata:    { sourceId: updated.sourceId, op: 'update' },
  })

  return NextResponse.json(updated)
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
