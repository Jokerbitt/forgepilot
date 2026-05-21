import { randomUUID } from 'crypto'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { Delegation, PrivacyMode } from '@/lib/models/delegation'
import type { ResearchPrivacyMode } from '@/lib/models/project-brief'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

function mapPrivacyMode(mode: ResearchPrivacyMode): PrivacyMode {
  if (mode === 'cloud') return 'public'
  if (mode === 'hybrid') return 'private-cloud'
  return 'local'
}

export async function createDelegationFromBrief(brief: ProjectBrief): Promise<Delegation> {
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
    status: 'pending',
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    contract: {
      id: contractId,
      workItemId: brief.title.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 20).toUpperCase() || 'TASK-001',
      goal: brief.title,
      context: contextParts.join('\n'),
      definitionOfDone,
      riskClass: 'A',
      maxBudgetUsd: 2,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      branchStrategy: 'feature',
      requiresApproval: true,
      privacyMode: mapPrivacyMode(brief.privacyMode ?? 'local'),
      createdAt: now,
    },
    logs: [],
    createdAt: now,
    updatedAt: now,
  })

  return delegation
}
