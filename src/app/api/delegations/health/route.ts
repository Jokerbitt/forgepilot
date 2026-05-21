/**
 * GET /api/delegations/health — fleet-wide delegation health snapshot.
 *
 * Detects stuck / silent / over-budget / forgotten delegations and
 * recommends a concrete next step. Drives the UI Health Monitor (M133)
 * and can be polled by an autonomy loop for self-healing.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { analyzeFleetHealth } from '@/lib/delegations/health'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export async function GET(): Promise<NextResponse> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegations = await repo.listByStatus()
  const snapshot = analyzeFleetHealth(delegations, new Date())
  return NextResponse.json(snapshot)
}
