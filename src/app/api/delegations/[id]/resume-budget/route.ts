export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

/**
 * POST /api/delegations/[id]/resume-budget
 *
 * Resume a budget-paused delegation: raise its budget and re-run it IN PLACE.
 * The execute route reuses the delegation's own worktree (worktreePath), so the
 * agent continues from where it stopped instead of rebuilding from scratch.
 *
 * Body (optional): { multiplier?: number }  — default 2x the current max budget.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)
  if (!delegation) return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })

  if (!delegation.budgetPaused) {
    return NextResponse.json(
      { error: 'Nur budget-pausierte Delegationen können fortgesetzt werden' },
      { status: 409 },
    )
  }

  let multiplier = 2
  try {
    const body = await req.json() as { multiplier?: number }
    if (typeof body.multiplier === 'number' && body.multiplier > 1 && body.multiplier <= 10) {
      multiplier = body.multiplier
    }
  } catch { /* no body — use default */ }

  const oldBudget = delegation.contract.maxBudgetUsd ?? 1
  const newBudget = Math.round(oldBudget * multiplier * 100) / 100

  await repo.update(id, {
    status: 'approved',
    budgetPaused: false,
    budgetPausedReason: undefined,
    errorMessage: undefined,
    contract: { ...delegation.contract, maxBudgetUsd: newBudget, maxCostUsd: undefined },
    logs: [
      ...(delegation.logs ?? []),
      {
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `↩️ Budget-Resume: Budget $${oldBudget.toFixed(2)} → $${newBudget.toFixed(2)}, Ausführung wird im eigenen Workspace fortgesetzt.`,
      },
    ],
  })

  // Re-run — execute route reuses the delegation's own worktree (continues in place)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/delegations/${id}/execute`, { method: 'POST' }).catch(() => {})

  return NextResponse.json({ resumed: true, delegationId: id, oldBudget, newBudget })
}
