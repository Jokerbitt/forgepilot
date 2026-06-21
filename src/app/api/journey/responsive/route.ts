export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/responsive
 * Body: { rootPath: string }
 * Returns: ResponsiveReport (mobile readiness score + plain-German findings)
 *
 * Phase 3.1 — static mobile/responsive readiness check (no browser needed).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkResponsive } from '@/lib/journey/responsive-check'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { rootPath?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const rootPath = body.rootPath?.trim()
  if (!rootPath) return NextResponse.json({ error: 'rootPath ist erforderlich' }, { status: 400 })

  return NextResponse.json(checkResponsive(rootPath))
}
