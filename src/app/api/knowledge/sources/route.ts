export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getSources, upsertSource, deleteSource } from '@/lib/knowledge/store'
import type { KnowledgeSource } from '@/lib/knowledge/types'

export async function GET() {
  return NextResponse.json(getSources())
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<KnowledgeSource>
  if (!body.type || !body.name || !body.path) {
    return NextResponse.json({ error: 'type, name, path required' }, { status: 400 })
  }
  const source: KnowledgeSource = {
    id: body.id ?? randomUUID(),
    type: body.type,
    name: body.name,
    path: body.path,
    hash: body.hash ?? '',
    privacyClass: body.privacyClass ?? 'internal',
    lastFetched: body.lastFetched ?? new Date().toISOString(),
    freshnessTtlHours: body.freshnessTtlHours ?? 24,
    isStale: body.isStale ?? false,
    metadata: body.metadata ?? {},
  }
  return NextResponse.json(upsertSource(source), { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const deleted = deleteSource(id)
  return NextResponse.json({ deleted })
}
