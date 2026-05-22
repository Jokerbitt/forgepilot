export const dynamic = 'force-dynamic'
/**
 * POST /api/autopilot/watchdog
 *
 * Invoked by the AutopilotRunner on a slower cadence (e.g., every 5 min).
 * Calls reapStaleDelegations to fail any running delegation whose agent
 * process has died or gone silent beyond the configured timeout.
 */
import { NextResponse } from 'next/server'
import { reapStaleDelegations } from '@/lib/delegations/watchdog'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export async function POST(request: Request) {
  const url     = new URL(request.url)
  const timeout = Math.max(5, Math.min(240, Number(url.searchParams.get('timeoutMinutes') ?? '10')))

  const repo   = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const reaped = await reapStaleDelegations(repo, { runningSilentMinutes: timeout })

  return NextResponse.json({
    ok: true,
    reaped: reaped.map(r => ({
      delegationId:  r.delegationId,
      title:         r.title,
      silentMinutes: r.silentMinutes,
    })),
    count:     reaped.length,
    timestamp: new Date().toISOString(),
  })
}
