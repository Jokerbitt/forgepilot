export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import {
  getPlanningAuditStats,
  listPlanningAuditRecords,
} from '@/lib/planning/planning-audit-store'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '50', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 0), 200) : 50

    return NextResponse.json({
      ok: true,
      records: listPlanningAuditRecords(limit),
      stats: getPlanningAuditStats(),
    }, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to read Grok planning audit log' }, { status: 500 })
  }
}
