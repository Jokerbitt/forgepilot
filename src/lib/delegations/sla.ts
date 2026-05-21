/**
 * Delegation SLA Tracker — M158
 *
 * Computes SLA deadlines from delegation.createdAt + risk-class hours.
 * No schema changes needed — everything is derived from existing fields.
 *
 * SLA hours by risk class (A = low, B = medium, C = high):
 *   A → 72 h
 *   B → 24 h
 *   C →  8 h
 *
 * Status transitions:
 *   ok       — > 25% time remaining
 *   warning  — ≤ 25% time remaining
 *   breached — past due date
 *   na       — delegation is in a terminal state (completed/failed/cancelled)
 */

import type { Delegation } from '@/lib/models/delegation'
import type { RiskClass } from '@/lib/models/work-item'

export type SlaStatus = 'ok' | 'warning' | 'breached' | 'na'

/** SLA hours per risk class: A = low (72h), B = medium (24h), C = high (8h) */
export const SLA_HOURS_BY_RISK: Record<RiskClass, number> = {
  A: 72,
  B: 24,
  C:  8,
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

/** Return the SLA deadline for a delegation, or null if none applies */
export function computeDueAt(delegation: Delegation): Date | null {
  if (TERMINAL_STATUSES.has(delegation.status)) return null
  const riskClass = delegation.contract?.riskClass
  if (!riskClass || !(riskClass in SLA_HOURS_BY_RISK)) return null
  const hours = SLA_HOURS_BY_RISK[riskClass]
  const created = new Date(delegation.createdAt)
  return new Date(created.getTime() + hours * 60 * 60 * 1000)
}

/** Return the SLA status for a delegation */
export function getSlaStatus(delegation: Delegation, now = new Date()): SlaStatus {
  if (TERMINAL_STATUSES.has(delegation.status)) return 'na'
  const dueAt = computeDueAt(delegation)
  if (!dueAt) return 'na'

  const totalMs  = dueAt.getTime() - new Date(delegation.createdAt).getTime()
  const remaining = dueAt.getTime() - now.getTime()

  if (remaining <= 0) return 'breached'
  if (remaining / totalMs <= 0.25) return 'warning'
  return 'ok'
}

/** Return a human-readable remaining time string, e.g. "3h 20m" or "Überfällig seit 1h" */
export function formatSlaRemaining(delegation: Delegation, now = new Date()): string {
  const dueAt = computeDueAt(delegation)
  if (!dueAt) return ''

  const diffMs = dueAt.getTime() - now.getTime()
  const absDiffMs = Math.abs(diffMs)
  const hours   = Math.floor(absDiffMs / 3_600_000)
  const minutes = Math.floor((absDiffMs % 3_600_000) / 60_000)

  const formatted =
    hours > 0
      ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim()
      : `${minutes}m`

  return diffMs < 0
    ? `Überfällig seit ${formatted}`
    : formatted
}

/** Return ISO string of the due date, or undefined */
export function getDueAtIso(delegation: Delegation): string | undefined {
  const dueAt = computeDueAt(delegation)
  return dueAt?.toISOString()
}
