export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRunnerReadiness } from '@/lib/runner-health/runner-detector'

/**
 * GET /api/runner-health
 * Full runner readiness check — all tools, credentials, services.
 * Used by the Settings page and pre-execution UI.
 */
export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError

  const readiness = await checkRunnerReadiness()
  return NextResponse.json(readiness, {
    headers: { 'cache-control': 'no-store' },
  })
}
