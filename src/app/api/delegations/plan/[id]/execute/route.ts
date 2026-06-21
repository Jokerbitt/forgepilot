export const dynamic = 'force-dynamic'

/**
 * POST /api/delegations/plan/[id]/execute
 *
 * Creates a delegation chain from a plan and starts the first phase.
 * Subsequent phases start automatically via the existing chainNextId mechanism.
 */

import { NextResponse } from 'next/server'
import { getPlan, savePlan } from '@/lib/delegations/plan-generator'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { randomUUID } from 'crypto'
import { allocateBudget } from '@/lib/delegations/budget-allocation'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const plan = getPlan(id)
  if (!plan) {
    return NextResponse.json({ error: 'Plan nicht gefunden' }, { status: 404 })
  }

  if (plan.status !== 'draft') {
    return NextResponse.json({ error: 'Plan wurde bereits ausgeführt' }, { status: 409 })
  }

  if (plan.phases.length === 0) {
    return NextResponse.json({ error: 'Plan hat keine Phasen' }, { status: 400 })
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const now = new Date().toISOString()

  // Pre-generate all delegation IDs so we can wire chainNextId before creation
  const ids = plan.phases.map(() => randomUUID())

  const createdIds: string[] = []

  // Budget: if the plan carries an overall budget, split it across phases by
  // effort; otherwise fall back to a fixed per-phase tier.
  const tierBudget = (turns: number) => (turns <= 40 ? 2 : turns <= 80 ? 3 : 5)
  const allocation = plan.totalBudgetUsd && plan.totalBudgetUsd > 0
    ? allocateBudget(plan.totalBudgetUsd, plan.phases)
    : null

  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i]!
    const id = ids[i]!
    const nextId = ids[i + 1] ?? null
    const phaseBudget = allocation?.perPhaseUsd[i] ?? tierBudget(phase.estimatedTurns)

    const dodList = phase.dodItems.length > 0
      ? phase.dodItems
      : [`Phase "${phase.title}" vollständig implementiert`, 'TypeScript 0 Errors', 'Tests bestanden']

    const contextParts = [
      `Plan: ${plan.overview}`,
      `Phase ${i + 1} von ${plan.phases.length}: ${phase.title}`,
      phase.description,
      phase.filesToCreate.length > 0 ? `Neue Dateien: ${phase.filesToCreate.join(', ')}` : '',
      phase.filesToModify.length > 0 ? `Zu ändernde Dateien: ${phase.filesToModify.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    // Phase can start immediately if it has no dependencies
    const canStartImmediately = phase.dependsOn.length === 0

    const delegation = await repo.create({
      id,
      title: `[Plan ${i + 1}/${plan.phases.length}] ${phase.title}`,
      contract: {
        id: randomUUID(),
        workItemId: plan.id,
        goal: phase.description || phase.title,
        context: contextParts,
        taskType: 'feature',
        definitionOfDone: dodList,
        riskClass: phase.riskClass,
        maxBudgetUsd: phaseBudget,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        branchStrategy: 'feature',
        requiresApproval: phase.riskClass === 'C',
        privacyMode: 'local',
        autoChain: nextId !== null,
        createdAt: now,
      },
      status: canStartImmediately ? 'approved' : 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: phaseBudget,
      chainNextId: nextId ?? undefined,
      chainPosition: i + 1,
      chainTotal: plan.phases.length,
      targetRepo: plan.targetRepo,
      tags: [`plan:${plan.id}`, `phase:${i + 1}`, ...phase.dependsOn.map(d => `depends:${d}`)],
      createdAt: now,
      updatedAt: now,
    })

    // Update plan phase with delegation ID
    plan.phases[i] = { ...phase, delegationId: delegation.id }
    createdIds.push(delegation.id)
  }

  // Mark plan as executing
  plan.status = 'executing'
  plan.updatedAt = new Date().toISOString()
  savePlan(plan)

  // Auto-start all phases that can run immediately (no dependencies)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  for (const [i, delegId] of createdIds.entries()) {
    const phase = plan.phases[i]!
    if (phase.dependsOn.length === 0) {
      // Fire-and-forget — never block the response
      fetch(`${baseUrl}/api/delegations/${delegId}/execute`, { method: 'POST' }).catch(() => {})
    }
  }

  const immediateCount = plan.phases.filter(p => p.dependsOn.length === 0).length
  return NextResponse.json({
    planId: plan.id,
    delegationIds: createdIds,
    firstDelegationId: createdIds[0],
    phaseCount: plan.phases.length,
    message: `${plan.phases.length} Delegationen erstellt. ${immediateCount} Phase(n) sofort gestartet.`,
  }, { status: 201 })
}
