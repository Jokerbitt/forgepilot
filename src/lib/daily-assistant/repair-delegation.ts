import type { Delegation, AgentLog } from '@/lib/models/delegation'
import { randomUUID } from 'crypto'
import type {
  CreateDelegationInput,
  DelegationRepository,
} from '@/lib/repositories/delegationRepository'

const REPAIR_TAG = 'delivery-repair'

export interface RepairDelegationResult {
  created: boolean
  delegation: Delegation
}

function repairWorkItemId(delegation: Delegation): string {
  return `repair:${delegation.id}`
}

function summarizeFailedCriteria(delegation: Delegation): string[] {
  return (delegation.qualityCheck?.criteria ?? [])
    .filter(criterion => !criterion.met)
    .map(criterion => `${criterion.item}: ${criterion.notes}`)
}

function buildRepairContext(delegation: Delegation): string {
  const failedCriteria = summarizeFailedCriteria(delegation)
  const critic = delegation.criticScore
  const quality = delegation.qualityCheck
  const prUrl = delegation.summaryReport?.prUrl

  return [
    '## Repair Context',
    `Original delegation: ${delegation.id}`,
    prUrl ? `Existing PR: ${prUrl}` : '',
    '',
    '## Original Goal',
    delegation.contract.goal,
    '',
    quality
      ? `## Quality Check\nVerdict: ${quality.verdict}; Score: ${quality.overallScore}/100${quality.suggestion ? `\nSuggestion: ${quality.suggestion}` : ''}`
      : '',
    failedCriteria.length > 0
      ? `Failed or unclear DoD criteria:\n${failedCriteria.map(item => `- ${item}`).join('\n')}`
      : '',
    critic
      ? `## Critic Review\nVerdict: ${critic.verdict}; correctness ${critic.correctness}/100; efficiency ${critic.efficiency}/100; drift ${critic.drift}/100\nSummary: ${critic.summary}`
      : '',
    '',
    '## Repair Instructions',
    'Fix only the issues above. Keep the diff small, preserve existing behavior, run focused tests, and update the PR/evidence afterwards.',
  ].filter(Boolean).join('\n')
}

export function buildRepairDelegationInput(delegation: Delegation, now = new Date()): CreateDelegationInput {
  const timestamp = now.toISOString()
  const riskClass = delegation.contract.riskClass
  const requiresApproval = riskClass === 'C'
  const logs: AgentLog[] = [{
    timestamp,
    type: 'info',
    message: `Repair-Slice automatisch aus Delivery-Gate erstellt fuer ${delegation.id}.`,
  }]

  return {
    title: `Repair: ${delegation.title || delegation.contract.goal}`.slice(0, 160),
    contract: {
      ...delegation.contract,
      id: randomUUID(),
      workItemId: repairWorkItemId(delegation),
      goal: `Repair failed delivery gate for: ${delegation.contract.goal}`,
      context: buildRepairContext(delegation),
      definitionOfDone: [
        'Root cause from Quality Check or Critic Review is fixed.',
        'Focused tests or type checks prove the repair.',
        'Summary report explains the changed files and remaining risk.',
        'Critic Review and Delivery Gate can continue without the same blocker.',
      ],
      requiresApproval,
      createdAt: timestamp,
    },
    status: requiresApproval ? 'pending' : 'approved',
    executionRoute: delegation.executionRoute,
    costEstimateUsd: Math.max(0.1, Math.min(delegation.costEstimateUsd || 0.5, 1.5)),
    priority: Math.min(delegation.priority ?? 50, 20),
    briefId: delegation.briefId,
    briefTitle: delegation.briefTitle,
    retryCount: (delegation.retryCount ?? 0) + 1,
    chainedFromId: delegation.id,
    tags: Array.from(new Set([...(delegation.tags ?? []), REPAIR_TAG])),
    logs,
  }
}

export async function findExistingRepairDelegation(
  repo: DelegationRepository,
  original: Delegation,
): Promise<Delegation | null> {
  const workItemId = repairWorkItemId(original)
  const delegations = await repo.listByStatus()
  return delegations.find(delegation =>
    delegation.id !== original.id
    && delegation.contract.workItemId === workItemId
    && delegation.status !== 'cancelled'
    && delegation.status !== 'rejected'
  ) ?? null
}

export async function ensureRepairDelegation(
  repo: DelegationRepository,
  original: Delegation,
): Promise<RepairDelegationResult> {
  const existing = await findExistingRepairDelegation(repo, original)
  if (existing) return { created: false, delegation: existing }

  const created = await repo.create(buildRepairDelegationInput(original))
  return { created: true, delegation: created }
}
