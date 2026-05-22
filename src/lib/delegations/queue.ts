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
}

export interface DelegationQueuePlan {
  mode: 'safe-preview'
  stats: QueueStats
  maxConcurrent: number
  recommendedBatchSize: number
  recommendedStartIds: string[]
  pendingApprovalIds: string[]
  nextAction: string
  warnings: string[]
  recommendedBatch: DelegationQueuePlanItem[]
  pendingApproval: DelegationQueuePlanItem[]
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

export function selectNextBatch(options: QueueSelectionOptions = {}): Delegation[] {
  const max = options.max ?? 3
  const maxConcurrent = options.maxConcurrent ?? 2
  const delegations = options.delegations ?? readDelegations()
  const running = delegations.filter(d => d.status === 'running').length
  const availableSlots = Math.max(0, maxConcurrent - running)
  const limit = Math.min(max, availableSlots)

  if (limit <= 0) return []

  return getApprovedDelegations(delegations).slice(0, limit)
}

function toPlanItem(delegation: Delegation): DelegationQueuePlanItem {
  return {
    id: delegation.id,
    title: delegation.title || delegation.contract.goal.slice(0, 80),
    status: delegation.status,
    priority: delegation.priority ?? 0,
    riskClass: delegation.contract.riskClass,
    requiresApproval: delegation.contract.requiresApproval,
    href: `/delegations/${delegation.id}`,
    actionHref: delegation.status === 'approved'
      ? `/api/delegations/${delegation.id}/start`
      : undefined,
  }
}

export function buildDelegationQueuePlan(options: QueueSelectionOptions = {}): DelegationQueuePlan {
  const maxConcurrent = options.maxConcurrent ?? 2
  const max = options.max ?? 2
  const delegations = options.delegations ?? readDelegations()
  const stats = getQueueStats(delegations)
  const recommendedBatch = selectNextBatch({ max, maxConcurrent, delegations })
  const pendingApproval = delegations
    .filter(d => d.status === 'pending' && (d.contract.requiresApproval || d.contract.riskClass !== 'A'))
    .sort(byPriorityThenAge)
    .slice(0, 5)
  const warnings: string[] = []

  if (stats.running >= maxConcurrent) {
    warnings.push(`Already running ${stats.running} delegation${stats.running === 1 ? '' : 's'}; do not start more until a slot is free.`)
  }

  if (stats.approved > recommendedBatch.length) {
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
    nextAction: buildQueueNextAction({ stats, recommendedBatch, pendingApproval, maxConcurrent }),
    warnings,
    recommendedBatch: recommendedBatch.map(toPlanItem),
    pendingApproval: pendingApproval.map(toPlanItem),
  }
}

function buildQueueNextAction(input: {
  stats: QueueStats
  recommendedBatch: Delegation[]
  pendingApproval: Delegation[]
  maxConcurrent: number
}): string {
  if (input.stats.running >= input.maxConcurrent) {
    return 'Wait for the running delegation slots to free up before starting more work.'
  }

  if (input.recommendedBatch.length > 0) {
    return `Start ${input.recommendedBatch.length} approved delegation${input.recommendedBatch.length === 1 ? '' : 's'} now, then refresh the Daily Report before starting another batch.`
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
