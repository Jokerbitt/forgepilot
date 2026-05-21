export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCards, upsertCard, deleteCard, queryCards } from '@/lib/knowledge/store'
import type { MemoryCard } from '@/lib/knowledge/types'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { KnowledgeCardSchema } from '@/lib/validation/schemas'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') ?? undefined
  const tags = searchParams.get('tags')?.split(',').filter(Boolean)
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined
  if (tags?.length || limit) {
    return NextResponse.json(queryCards({ projectId, tags, limit }))
  }
  return NextResponse.json(getCards(projectId))
}

export async function POST(req: NextRequest) {
  const result = await parseBody(req, KnowledgeCardSchema)
  if (isValidationError(result)) return result

  const now = new Date().toISOString()
  const card: MemoryCard = {
    id: result.id ?? randomUUID(),
    type: result.type,
    title: result.title,
    body: result.body,
    sourceIds: result.sourceIds ?? [],
    projectId: result.projectId,
    tags: result.tags ?? [],
    privacyClass: result.privacyClass ?? 'internal',
    confidence: result.confidence ?? 'medium',
    createdAt: result.createdAt ?? now,
    updatedAt: now,
  }
  return NextResponse.json(upsertCard(card), { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  return NextResponse.json({ deleted: deleteCard(id) })
}
