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

  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i]!
    const id = ids[i]!
    const nextId = ids[i + 1] ?? null

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
        maxBudgetUsd: phase.estimatedTurns <= 40 ? 1 : phase.estimatedTurns <= 80 ? 2 : 3,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        branchStrategy: 'feature',
        requiresApproval: phase.riskClass === 'C',
        privacyMode: 'local',
        autoChain: nextId !== null,
        createdAt: now,
      },
      status: i === 0 ? 'approved' : 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: phase.estimatedTurns <= 40 ? 1 : phase.estimatedTurns <= 80 ? 2 : 3,
      chainNextId: nextId ?? undefined,
      chainPosition: i + 1,
      chainTotal: plan.phases.length,
      targetRepo: plan.targetRepo,
      tags: [`plan:${plan.id}`, `phase:${i + 1}`],
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

  return NextResponse.json({
    planId: plan.id,
    delegationIds: createdIds,
    firstDelegationId: createdIds[0],
    phaseCount: plan.phases.length,
    message: `${plan.phases.length} Delegationen erstellt. Phase 1 ist bereit zum Start.`,
  }, { status: 201 })
}
