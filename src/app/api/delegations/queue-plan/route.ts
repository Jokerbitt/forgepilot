export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { buildDelegationQueuePlan } from '@/lib/delegations/queue'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { reapStaleDelegations } from '@/lib/delegations/watchdog'

export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  await reapStaleDelegations(repo)
  const delegations = await repo.listByStatus(['pending', 'approved', 'running'])
  const plan = buildDelegationQueuePlan({
    delegations,
    max: 2,
    maxConcurrent: 2,
  })

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      plan,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
