import fs from 'fs'
import path from 'path'
import type { Delegation } from '../models/delegation'

/**
 * Scheduled Delegation Queue (M120)
 *
 * Provides utilities for reading, prioritising, and selecting delegations
 * for automated cron-based execution.  Pure read/sort logic — no side effects
 * except for optional status writes done explicitly by the cron route.
 */

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

// ─── read helpers ─────────────────────────────────────────────────────────────

export function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

// ─── queue logic ──────────────────────────────────────────────────────────────

/**
 * Return all delegations with status === 'approved', sorted by:
 * 1. priority desc (higher number = higher priority)
 * 2. createdAt asc (older first as tie-breaker)
 */
export function getApprovedDelegations(): Delegation[] {
  return readDelegations()
    .filter(d => d.status === 'approved')
    .sort((a, b) => {
      const pDiff = (b.priority ?? 0) - (a.priority ?? 0)
      if (pDiff !== 0) return pDiff
      return a.createdAt.localeCompare(b.createdAt)
    })
}

/**
 * Select up to `max` approved delegations for the next execution batch.
 * Respects concurrency: skips if `currentlyRunning >= maxConcurrent`.
 */
export function selectNextBatch(opts: {
  max?: number
  maxConcurrent?: number
} = {}): Delegation[] {
  const { max = 3, maxConcurrent = 2 } = opts
  const all = readDelegations()
  const running = all.filter(d => d.status === 'running').length

  if (running >= maxConcurrent) return []

  const available = max - running
  if (available <= 0) return []

  return getApprovedDelegations().slice(0, available)
}

// ─── queue stats ──────────────────────────────────────────────────────────────

export interface QueueStats {
  pending:   number
  approved:  number
  running:   number
  completed: number
  failed:    number
  cancelled: number
  total:     number
}

/**
 * Return a summary count of delegations by status.
 */
export function getQueueStats(): QueueStats {
  const all = readDelegations()
  const count = (status: string) => all.filter(d => d.status === status).length
  return {
    pending:   count('pending'),
    approved:  count('approved'),
    running:   count('running'),
    completed: count('completed'),
    failed:    count('failed'),
    cancelled: count('cancelled'),
    total:     all.length,
  }
}
