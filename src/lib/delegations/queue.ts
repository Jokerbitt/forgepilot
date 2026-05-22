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
