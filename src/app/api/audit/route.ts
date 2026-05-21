export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuditLog, getAuditStats } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const entityId = url.searchParams.get('entityId') ?? undefined
    const statsOnly = url.searchParams.get('stats') === 'true'

    if (statsOnly) {
      return NextResponse.json(getAuditStats())
    }
    return NextResponse.json(getAuditLog(limit, entityId))
  } catch {
    return NextResponse.json({ error: 'Failed to read audit log' }, { status: 500 })
  }
}
