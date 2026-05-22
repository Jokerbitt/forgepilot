export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { buildFailedDelegationTriage } from '@/lib/delegations/triage'
import { buildFailedDelegationActionPlan } from '@/lib/delegations/triage-actions'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const failedDelegations = await repo.listByStatus(['failed'])
  const triage = buildFailedDelegationTriage(failedDelegations)
  const actionPlan = buildFailedDelegationActionPlan(triage)

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      triage,
      actionPlan,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
