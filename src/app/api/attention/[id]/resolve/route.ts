import { NextResponse } from 'next/server'
import { resolveAttentionItem } from '@/lib/attention/store'

export const dynamic = 'force-dynamic'

/** POST /api/attention/[id]/resolve */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const resolved = resolveAttentionItem(params.id, 'user')
  if (!resolved) {
    return NextResponse.json({ error: 'Item nicht gefunden' }, { status: 404 })
  }
  return NextResponse.json({ resolved: true })
}
