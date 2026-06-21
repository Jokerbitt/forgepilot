export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getNextLoopAction, computeLoopStats } from '@/lib/delegations/loop-closure'

/**
 * GET /api/loop
 * Returns the current loop state: next action + today's stats.
 * Used by the Command Center AutonomousLoopPanel.
 */
export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError

  const [nextAction, stats] = await Promise.all([
    getNextLoopAction(),
    computeLoopStats(),
  ])

  return NextResponse.json({
    nextAction,
    stats,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'cache-control': 'no-store' } })
}
