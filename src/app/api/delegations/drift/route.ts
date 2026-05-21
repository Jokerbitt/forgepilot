export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { analyzeDrift } from '@/lib/drift-detector'
import { budgetToMaxTurns } from '@/lib/budget-utils'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

/** GET /api/delegations/drift?id=<delegationId> */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  if (!id) {
    // Return drift analysis for all running delegations
    const all = await repo.listByStatus(['running'])
    const analyses = all.map(d => ({
      delegationId: d.id,
      title: d.title ?? d.contract.goal.substring(0, 60),
      status: d.status,
      drift: analyzeDrift(d.logs ?? [], budgetToMaxTurns(d.contract.maxBudgetUsd)),
    }))
    return NextResponse.json(analyses)
  }

  const delegation = await repo.findById(id)
  if (!delegation) {
    return NextResponse.json({ error: `Delegation ${id} not found` }, { status: 404 })
  }

  const analysis = analyzeDrift(
    delegation.logs ?? [],
    budgetToMaxTurns(delegation.contract.maxBudgetUsd)
  )
  return NextResponse.json({ delegationId: id, drift: analysis })
}
