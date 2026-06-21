export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/maintenance
 * Body: { targetRepo: string }
 * Returns: MaintenanceReport (security findings + outdated deps + plain summary)
 *
 * Phase 3.2 — on-demand maintenance check for a built app.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { buildMaintenanceReport } from '@/lib/journey/maintenance'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { targetRepo?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const targetRepo = body.targetRepo?.trim()
  if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })

  return NextResponse.json(buildMaintenanceReport(targetRepo))
}
