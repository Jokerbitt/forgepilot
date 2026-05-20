export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getResearchDocument } from '@/lib/knowledge/research-store'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const doc = getResearchDocument(params.id)
  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(doc)
}
