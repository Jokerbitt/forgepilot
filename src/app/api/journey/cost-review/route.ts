export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/cost-review
 * Body: { delegationIds: string[], appName?: string }
 * Returns: CostReview (plain-German real-cost review after a build)
 *
 * Phase 4.2 — real-cost review. Loads the build's delegations, sums the
 * up-front estimate (costEstimateUsd) and the actual cost (actualCostUsd) plus
 * the budget cap (contract.maxBudgetUsd), then phrases "teurer/günstiger als
 * gedacht? im Budget?" in plain German.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { aggregateDelegationCosts, reviewCost, type DelegationCostFields } from '@/lib/journey/cost-review'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { delegationIds?: unknown; appName?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const ids = Array.isArray(body.delegationIds)
    ? body.delegationIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  if (ids.length === 0) return NextResponse.json({ error: 'delegationIds erforderlich' }, { status: 400 })

  const appName = typeof body.appName === 'string' ? body.appName : undefined

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const loaded = await Promise.all(ids.map(id => repo.findById(id)))
  const costFields: DelegationCostFields[] = loaded
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map(d => ({
      costEstimateUsd: d.costEstimateUsd,
      actualCostUsd: d.actualCostUsd,
      maxBudgetUsd: d.contract.maxBudgetUsd,
    }))

  const agg = aggregateDelegationCosts(costFields)
  return NextResponse.json(reviewCost({ ...agg, appName }))
}
