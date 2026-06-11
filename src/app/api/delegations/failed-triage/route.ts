export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { applyFailedDelegationAutoTriage } from '@/lib/delegations/auto-triage'
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

export async function POST(request: Request) {
  const authError = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({})) as {
    mode?: 'preview' | 'apply'
    maxBatchSize?: number
  }
  const mode = body.mode === 'apply' ? 'apply' : 'preview'
  const batchSize = Number.isFinite(body.maxBatchSize)
    ? Math.max(0, Math.min(5, Number(body.maxBatchSize)))
    : 2

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const failedDelegations = await repo.listByStatus(['failed'])
  const triage = buildFailedDelegationTriage(failedDelegations)
  const actionPlan = buildFailedDelegationActionPlan(triage, { batchSize })
  const autoTriage = await applyFailedDelegationAutoTriage({
    repo,
    failedDelegations,
    actionPlan,
    mode,
  })

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      triage,
      actionPlan,
      autoTriage,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
