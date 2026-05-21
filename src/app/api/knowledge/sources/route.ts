export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getSources, upsertSource, deleteSource } from '@/lib/knowledge/store'
import type { KnowledgeSource } from '@/lib/knowledge/types'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { KnowledgeSourceSchema } from '@/lib/validation/schemas'

export async function GET() {
  return NextResponse.json(getSources())
}

export async function POST(req: NextRequest) {
  const result = await parseBody(req, KnowledgeSourceSchema)
  if (isValidationError(result)) return result

  const source: KnowledgeSource = {
    id: result.id ?? randomUUID(),
    type: result.type,
    name: result.name,
    path: result.path,
    hash: result.hash ?? '',
    privacyClass: result.privacyClass ?? 'internal',
    lastFetched: result.lastFetched ?? new Date().toISOString(),
    freshnessTtlHours: result.freshnessTtlHours ?? 24,
    isStale: result.isStale ?? false,
    metadata: result.metadata ?? {},
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
