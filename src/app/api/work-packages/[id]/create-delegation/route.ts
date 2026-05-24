export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { readWorkPackages } from '@/lib/knowledge/milestone-store'
import type { Delegation } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const workPackages = readWorkPackages()
  const wp = workPackages.find(w => w.id === id)

  if (!wp) {
    return NextResponse.json({ error: 'Work Package nicht gefunden' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const contractId = randomUUID()
  const delegationId = randomUUID()

  const maxBudgetUsd = Math.max(1.0, wp.estimatedHours * 0.5)
  const branchStrategy = wp.riskClass === 'C' ? 'fix' : 'feature'
  const taskType = wp.tags.includes('test') ? 'bugfix' : 'feature'

  const delegation: Delegation = {
    id: delegationId,
    title: wp.title,
    contract: {
      id: contractId,
      workItemId: wp.id,
      goal: wp.description,
      context: '',
      taskType,
      definitionOfDone: wp.definitionOfDone,
      riskClass: wp.riskClass,
      maxBudgetUsd,
      allowedTools: ['bash', 'read_file', 'write_file'],
      branchStrategy,
      requiresApproval: wp.riskClass === 'C',
      privacyMode: 'local',
      createdAt: now,
    },
    status: 'pending',
    executionRoute: 'ollama-agent',
    costEstimateUsd: 0,
    briefId: wp.briefId,
    logs: [{
      timestamp: now,
      type: 'info',
      message: `Delegation aus Work Package "${wp.title}" erstellt (Risk ${wp.riskClass}, ${wp.estimatedHours}h geschätzt)`,
    }],
    createdAt: now,
    updatedAt: now,
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const created = await repo.create(delegation)

  return NextResponse.json({ delegationId: created.id, delegation: created }, { status: 201 })
}
