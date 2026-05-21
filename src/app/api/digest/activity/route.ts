export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from 'next/server'
import { buildDigest } from '@/lib/digest/digest-builder'
import type { DigestPeriod } from '@/lib/digest/digest-builder'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('period') ?? 'daily'
  const period: DigestPeriod = raw === 'weekly' ? 'weekly' : 'daily'

  try {
    const digest = buildDigest(period)
    return NextResponse.json(digest)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to build digest: ${msg}` }, { status: 500 })
  }
}
