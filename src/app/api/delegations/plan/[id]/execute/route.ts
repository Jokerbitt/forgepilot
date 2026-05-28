export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getPlan, updatePlan } from '@/lib/delegations/plan-generator'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import type { Delegation, TaskContract } from '@/lib/models/delegation'
import { budgetForComplexity } from '@/lib/budget-utils'

/** Convert a plan phase into a delegation that can be linked in a chain. */
function phaseToContract(
  phase: import('@/lib/delegations/plan-generator').PlanPhase,
  planGoal: string,
  planContext: string,
  _targetRepo: string,
): TaskContract {
  const budget = budgetForComplexity(phase.dodItems, phase.description)
  return {
    id: `contract-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    goal: `[Phase: ${phase.title}]\n${phase.description}\n\nFiles to create: ${phase.filesToCreate.join(', ') || 'none'}\nFiles to modify: ${phase.filesToModify.join(', ') || 'none'}`,
    context: `Part of plan: ${planGoal}\n\n${planContext}`,
    definitionOfDone: phase.dodItems,
    riskClass: phase.riskClass,
    branchStrategy: 'feature',
    workItemId: `plan-${phase.id}`,
    maxBudgetUsd: budget,
    requiresApproval: phase.riskClass === 'C',
    privacyMode: 'local',
    llmModel: 'claude-sonnet',
    taskType: 'feature',
    allowedTools: [],
    skillCategory: phase.skillCategory,
    allowedFilePatterns: [
      ...phase.filesToCreate,
      ...phase.filesToModify,
    ].filter(Boolean),
    autoChain: true, // M206: auto-start next phase on completion
    createdAt: new Date().toISOString(),
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params

  const plan = getPlan(id)
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  if (plan.status !== 'draft') return NextResponse.json({ error: 'Plan already executing or done' }, { status: 400 })
  if (plan.phases.length === 0) return NextResponse.json({ error: 'Plan has no phases' }, { status: 400 })

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const now = new Date().toISOString()
  const delegationIds: string[] = []

  // Create all delegations first (all pending/draft state)
  const created: Delegation[] = []
  for (const phase of plan.phases) {
    const contract = phaseToContract(phase, plan.goal, plan.context, plan.targetRepo)
    const delegation = await repo.create({
      title: `[Plan] ${phase.title}`,
      contract,
      status: 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: contract.maxBudgetUsd * 0.5,
      chainPosition: created.length + 1,
      chainTotal: plan.phases.length,
      ...(plan.targetRepo ? { targetRepo: plan.targetRepo } : {}),
      logs: [{
        timestamp: now,
        type: 'info',
        message: `📋 Erstellt aus Plan "${plan.goal.slice(0, 60)}" — Phase ${created.length + 1}/${plan.phases.length}`,
      }],
    })
    created.push(delegation)
    delegationIds.push(delegation.id)
  }

  // Wire up the chain: each delegation points to the next
  for (let i = 0; i < created.length - 1; i++) {
    await repo.update(created[i].id, {
      chainNextId: created[i + 1].id,
    })
    await repo.update(created[i + 1].id, {
      chainPrevId: created[i].id,
    })
  }

  // Approve + start first delegation (rest will auto-chain)
  await repo.update(created[0].id, { status: 'approved' })
  void fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/delegations/${created[0].id}/execute`, {
    method: 'POST',
  }).catch(() => {}) // fire-and-forget

  // Update plan status
  updatePlan(id, { status: 'executing', delegationIds })

  return NextResponse.json({
    planId: id,
    delegationIds,
    firstDelegationId: created[0].id,
    message: `${plan.phases.length} Delegationen erstellt und erste Phase gestartet`,
  })
}
