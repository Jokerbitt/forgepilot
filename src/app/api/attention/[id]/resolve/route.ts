import { NextResponse } from 'next/server'
import { resolveAttentionItem } from '@/lib/attention/store'

export const dynamic = 'force-dynamic'

/** POST /api/attention/[id]/resolve */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const resolved = resolveAttentionItem(id, 'user')
  if (!resolved) {
    return NextResponse.json({ error: 'Item nicht gefunden' }, { status: 404 })
  }
  return NextResponse.json({ resolved: true })
}
