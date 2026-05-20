export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getResearchDocument } from '@/lib/knowledge/research-store'
import { computeQuality } from '@/lib/knowledge/quality-scorer'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const doc = getResearchDocument(id)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(computeQuality(doc))
}
