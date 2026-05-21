export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { findProjectBriefById, updateProjectBrief } from '@/lib/project-briefs'
import type { PrivacyMode } from '@/lib/models/delegation'
import type { ResearchPrivacyMode } from '@/lib/models/project-brief'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'

function mapPrivacyMode(mode: ResearchPrivacyMode): PrivacyMode {
  if (mode === 'cloud') return 'public'
  if (mode === 'hybrid') return 'private-cloud'
  return 'local'
}

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const brief = findProjectBriefById(id)
  if (!brief) {
    return NextResponse.json({ error: 'Brief nicht gefunden' }, { status: 404 })
  }

  if (brief.status !== 'accepted') {
    return NextResponse.json(
      { error: 'Brief muss freigegeben sein, bevor eine Delegation erstellt werden kann' },
      { status: 422 },
    )
  }

  const acceptedReqs = brief.requirements.filter(r => r.status === 'accepted')
  const definitionOfDone = acceptedReqs.length > 0
    ? acceptedReqs.map(r => r.title)
    : [brief.desiredOutcome]

  const contextParts = [
    `Idee: ${brief.rawIdea}`,
    `Problem: ${brief.problemStatement}`,
    `Zielgruppe: ${brief.targetAudience}`,
  ]
  if (brief.constraints.length > 0) {
    contextParts.push(`Constraints: ${brief.constraints.join(', ')}`)
  }
  if (brief.nonGoals.length > 0) {
    contextParts.push(`Nicht-Ziele: ${brief.nonGoals.join(', ')}`)
  }

  const now = new Date().toISOString()
  const contractId = randomUUID()
  const delegationId = randomUUID()

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const delegation = await repo.create({
    id: delegationId,
    title: brief.title.slice(0, 80),
    briefId: brief.id,
    briefTitle: brief.title,
    contract: {
      id: contractId,
      workItemId: `BRIEF-${brief.id.slice(0, 8).toUpperCase()}`,
      goal: brief.desiredOutcome,
      context: contextParts.join('\n'),
      taskType: 'feature',
      definitionOfDone,
      riskClass: 'A',
      maxBudgetUsd: 10,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: mapPrivacyMode(brief.privacyMode),
      createdAt: now,
    },
    status: 'pending',
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    logs: [{
      timestamp: now,
      type: 'info',
      message: `Delegation aus Projektbrief "${brief.title}" erstellt (${acceptedReqs.length} akzeptierte Requirements)`,
    }],
  })

  // Link delegation back to brief
  updateProjectBrief(brief.id, {
    delegationIds: [...(brief.delegationIds ?? []), delegationId],
  })

  return NextResponse.json(delegation, { status: 201 })
}
