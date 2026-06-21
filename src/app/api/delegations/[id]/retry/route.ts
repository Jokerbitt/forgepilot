export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { buildRetryDelegationPatch, buildRetryPlan } from '@/lib/delegations/retry'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const delegation = await repo.findById(id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  if (delegation.status !== 'failed' && delegation.status !== 'cancelled') {
    return NextResponse.json(
      { error: `Retry nicht möglich — Status ist '${delegation.status}'` },
      { status: 400 },
    )
  }

  const plan = buildRetryPlan(delegation)
  if (!plan.shouldRetry) {
    return NextResponse.json(
      {
        error: plan.diagnosticMessage,
        retryCount: plan.retryCount,
        maxRetries: plan.maxRetries,
        failureCause: plan.failureCause,
      },
      { status: plan.maxRetriesReached ? 429 : 409 },
    )
  }

  await repo.update(id, buildRetryDelegationPatch(delegation, plan))

  return NextResponse.json({
    retried: true,
    delegationId: id,
    retryCount: plan.retryCount + 1,
    failureCause: plan.failureCause,
    diagnosticMessage: plan.diagnosticMessage,
  })
}
