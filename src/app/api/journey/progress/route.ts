export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/progress
 * Body: { delegationIds: string[] }
 * Returns: PlanProgressView (plain-German build progress for the given chain)
 *
 * Powers the Journey Companion's live progress view: it loads the delegations of
 * a build (the ids returned by /api/suggestions/build, /api/reverse/rebuild, …)
 * and humanizes their state. The UI polls this while a build runs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { humanizePlanProgress, type ProgressInput } from '@/lib/journey/progress'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { delegationIds?: string[] }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const ids = Array.isArray(body.delegationIds) ? body.delegationIds.filter(id => typeof id === 'string' && id) : []
  if (ids.length === 0) return NextResponse.json({ error: 'delegationIds erforderlich' }, { status: 400 })

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const items: ProgressInput[] = []
  for (const id of ids) {
    const d = await repo.findById(id)
    if (!d) continue
    items.push({
      title: d.title,
      status: d.status,
      chainPosition: d.chainPosition,
      chainTotal: d.chainTotal,
      retryCount: d.retryCount,
      budgetPaused: d.budgetPaused,
      errorMessage: d.errorMessage,
      failureFeedback: d.failureFeedback,
    })
  }

  return NextResponse.json(humanizePlanProgress(items))
}
