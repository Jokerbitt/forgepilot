import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCards, upsertCard, deleteCard, queryCards } from '@/lib/knowledge/store'
import type { MemoryCard } from '@/lib/knowledge/types'

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

export async function POST(req: Request) {
  const body = await req.json() as Partial<MemoryCard>
  if (!body.type || !body.title || !body.body) {
    return NextResponse.json({ error: 'type, title, body required' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const card: MemoryCard = {
    id: body.id ?? randomUUID(),
    type: body.type,
    title: body.title,
    body: body.body,
    sourceIds: body.sourceIds ?? [],
    projectId: body.projectId,
    tags: body.tags ?? [],
    privacyClass: body.privacyClass ?? 'internal',
    confidence: body.confidence ?? 'medium',
    createdAt: body.createdAt ?? now,
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
