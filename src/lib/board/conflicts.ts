import type { Delegation } from '@/lib/models/delegation'

export interface ConflictWarning {
  delegationIds: string[]
  reason: string
}

const ACTIVE_STATUSES: Delegation['status'][] = ['pending', 'approved', 'running']

/**
 * Detect delegations that likely conflict with each other.
 * Two active delegations conflict when they share the same workItemId or briefId.
 */
export function detectConflicts(delegations: Delegation[]): ConflictWarning[] {
  const active = delegations.filter(d => ACTIVE_STATUSES.includes(d.status))
  const warnings: ConflictWarning[] = []

  // Group by workItemId
  const byWorkItem = new Map<string, string[]>()
  for (const d of active) {
    const key = d.contract.workItemId
    if (!key) continue
    const group = byWorkItem.get(key) ?? []
    group.push(d.id)
    byWorkItem.set(key, group)
  }
  for (const [key, ids] of Array.from(byWorkItem)) {
    if (ids.length > 1) {
      warnings.push({ delegationIds: ids, reason: `Gleiches Work Item: ${key}` })
    }
  }

  // Group by briefId
  const byBrief = new Map<string, string[]>()
  for (const d of active) {
    if (!d.briefId) continue
    const group = byBrief.get(d.briefId) ?? []
    group.push(d.id)
    byBrief.set(d.briefId, group)
  }
  for (const [briefId, ids] of Array.from(byBrief)) {
    if (ids.length > 1) {
      warnings.push({ delegationIds: ids, reason: `Gleiches Projekt-Brief: ${briefId}` })
    }
  }

  return warnings
}

/**
 * Returns a Set of delegation IDs that are part of at least one conflict.
 */
export function conflictingIds(warnings: ConflictWarning[]): Set<string> {
  const ids = new Set<string>()
  for (const w of warnings) {
    for (const id of w.delegationIds) ids.add(id)
  }
  return ids
}
