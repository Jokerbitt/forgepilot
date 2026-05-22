export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { reapStaleRuns } from '@/lib/agents/orchestrated-run'

export async function POST() {
  const reaped = reapStaleRuns()
  return NextResponse.json({
    ok: true,
    reaped,
    count: reaped.length,
    timestamp: new Date().toISOString(),
  })
}
