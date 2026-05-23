import fs from 'fs'
import path from 'path'
import type { Delegation } from '../models/delegation'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

export interface QueueSelectionOptions {
  max?: number
  maxConcurrent?: number
  delegations?: Delegation[]
}

export interface QueueStats {
  pending: number
  approved: number
  running: number
  completed: number
  failed: number
  cancelled: number
  rejected: number
  total: number
}

export interface DelegationQueuePlanItem {
  id: string
  title: string
  status: Delegation['status']
  priority: number
  riskClass: Delegation['contract']['riskClass']
  requiresApproval: boolean
  href: string
  actionHref?: string
  blocker?: string
}

export interface DelegationQueuePlan {
  mode: 'safe-preview'
  stats: QueueStats
  maxConcurrent: number
  recommendedBatchSize: number
  recommendedStartIds: string[]
  pendingApprovalIds: string[]
  blockedStartIds: string[]
  nextAction: string
  warnings: string[]
  recommendedBatch: DelegationQueuePlanItem[]
  pendingApproval: DelegationQueuePlanItem[]
  blockedStart: DelegationQueuePlanItem[]
}

export function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function byPriorityThenAge(a: Delegation, b: Delegation): number {
  const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0)
  if (priorityDelta !== 0) return priorityDelta
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

export function getApprovedDelegations(delegations = readDelegations()): Delegation[] {
  return delegations
    .filter(d => d.status === 'approved')
    .sort(byPriorityThenAge)
}

export function getStartBlocker(delegation: Delegation): string | undefined {
  if (delegation.status !== 'approved') {
    return 'Delegation is not approved yet.'
  }

  const budget = delegation.contract.maxBudgetUsd
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) {
    return 'Set maxBudgetUsd greater than 0 before automatic execution.'
  }

  if (!delegation.contract.definitionOfDone?.some(item => item.trim().length > 0)) {
    return 'Add at least one Definition of Done item before automatic execution.'
  }

  return undefined
}

export function getStartableApprovedDelegations(delegations = readDelegations()): Delegation[] {
  return getApprovedDelegations(delegations).filter(d => !getStartBlocker(d))
}

export function selectNextBatch(options: QueueSelectionOptions = {}): Delegation[] {
  const max = options.max ?? 3
  const maxConcurrent = options.maxConcurrent ?? 2
  const delegations = options.delegations ?? readDelegations()
  const running = delegations.filter(d => d.status === 'running').length
  const availableSlots = Math.max(0, maxConcurrent - running)
  const limit = Math.min(max, availableSlots)

  if (limit <= 0) return []

  return getStartableApprovedDelegations(delegations).slice(0, limit)
}

function toPlanItem(delegation: Delegation, blocker?: string): DelegationQueuePlanItem {
  return {
    id: delegation.id,
    title: delegation.title || delegation.contract.goal.slice(0, 80),
    status: delegation.status,
    priority: delegation.priority ?? 0,
    riskClass: delegation.contract.riskClass,
    requiresApproval: delegation.contract.requiresApproval,
    href: `/delegations/${delegation.id}`,
    actionHref: delegation.status === 'approved' && !blocker
      ? `/api/delegations/${delegation.id}/start`
      : undefined,
    blocker,
  }
}

export function buildDelegationQueuePlan(options: QueueSelectionOptions = {}): DelegationQueuePlan {
  const maxConcurrent = options.maxConcurrent ?? 2
  const max = options.max ?? 2
  const delegations = options.delegations ?? readDelegations()
  const stats = getQueueStats(delegations)
  const recommendedBatch = selectNextBatch({ max, maxConcurrent, delegations })
  const allBlockedStart = getApprovedDelegations(delegations)
    .map(delegation => ({ delegation, blocker: getStartBlocker(delegation) }))
    .filter((entry): entry is { delegation: Delegation; blocker: string } => Boolean(entry.blocker))
  const blockedStart = allBlockedStart
    .slice(0, 5)
  const pendingApproval = delegations
    .filter(d => d.status === 'pending' && (d.contract.requiresApproval || d.contract.riskClass !== 'A'))
    .sort(byPriorityThenAge)
    .slice(0, 5)
  const warnings: string[] = []

  if (stats.running >= maxConcurrent) {
    warnings.push(`Already running ${stats.running} delegation${stats.running === 1 ? '' : 's'}; do not start more until a slot is free.`)
  }

  if (allBlockedStart.length > 0) {
    warnings.push(`${allBlockedStart.length} approved delegation${allBlockedStart.length === 1 ? '' : 's'} cannot start until execution blockers are fixed.`)
  }

  if (stats.approved > recommendedBatch.length + allBlockedStart.length) {
    warnings.push(`Start only ${recommendedBatch.length} approved delegation${recommendedBatch.length === 1 ? '' : 's'} first; keep concurrency capped at ${maxConcurrent}.`)
  }

  if (pendingApproval.length > 0) {
    warnings.push(`${pendingApproval.length} pending delegation${pendingApproval.length === 1 ? '' : 's'} need approval or clearer risk handling before execution.`)
  }

  return {
    mode: 'safe-preview',
    stats,
    maxConcurrent,
    recommendedBatchSize: recommendedBatch.length,
    recommendedStartIds: recommendedBatch.map(d => d.id),
    pendingApprovalIds: pendingApproval.map(d => d.id),
    blockedStartIds: allBlockedStart.map(entry => entry.delegation.id),
    nextAction: buildQueueNextAction({ stats, recommendedBatch, pendingApproval, blockedStart: allBlockedStart, maxConcurrent }),
    warnings,
    recommendedBatch: recommendedBatch.map(delegation => toPlanItem(delegation)),
    pendingApproval: pendingApproval.map(delegation => toPlanItem(delegation)),
    blockedStart: blockedStart.map(entry => toPlanItem(entry.delegation, entry.blocker)),
  }
}

function buildQueueNextAction(input: {
  stats: QueueStats
  recommendedBatch: Delegation[]
  pendingApproval: Delegation[]
  blockedStart: Array<{ delegation: Delegation; blocker: string }>
  maxConcurrent: number
}): string {
  if (input.stats.running >= input.maxConcurrent) {
    return 'Wait for the running delegation slots to free up before starting more work.'
  }

  if (input.recommendedBatch.length > 0) {
    return `Start ${input.recommendedBatch.length} approved delegation${input.recommendedBatch.length === 1 ? '' : 's'} now, then refresh the Daily Report before starting another batch.`
  }

  if (input.blockedStart.length > 0) {
    return 'Fix the execution blockers on the highest-priority approved delegation, then refresh the queue plan before starting the runner.'
  }

  if (input.pendingApproval.length > 0) {
    return 'Review and approve the highest-priority pending delegations before starting execution.'
  }

  return 'No queued delegation needs action right now; create the next small real-value ticket.'
}

export function getQueueStats(delegations = readDelegations()): QueueStats {
  const stats: QueueStats = {
    pending: 0,
    approved: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    rejected: 0,
    total: delegations.length,
  }

  for (const delegation of delegations) {
    stats[delegation.status] += 1
  }

  return stats
}
