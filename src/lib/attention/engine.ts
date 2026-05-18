import type { Delegation } from '@/lib/models/delegation'
import type { AttentionItem, AttentionType, AttentionSeverity } from '@/lib/models/attention'
import { getOpenAttentionItems, upsertAttentionItem, resolveItemsByDelegation } from './store'

const STALL_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes without log update

function makeId(type: AttentionType, delegationId: string): string {
  return `${type}:${delegationId}`
}

function severityFor(type: AttentionType): AttentionSeverity {
  if (type === 'delegation_failed' || type === 'budget_exceeded' || type === 'system_error') return 'critical'
  if (type === 'delegation_stalled' || type === 'escalation') return 'warning'
  return 'info'
}

function buildItem(
  type: AttentionType,
  delegation: Delegation,
  title: string,
  body: string,
): AttentionItem {
  return {
    id: makeId(type, delegation.id),
    type,
    severity: severityFor(type),
    title,
    body,
    delegationId: delegation.id,
    actionUrl: `/delegations/${delegation.id}`,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Scan all delegations and sync attention items.
 * Called by the attention API on each GET request.
 */
export function syncAttentionFromDelegations(delegations: Delegation[]): void {
  const existing = getOpenAttentionItems()
  const existingIds = new Set(existing.map(i => i.id))

  for (const d of delegations) {
    const label = d.title || d.contract.goal.slice(0, 60)

    // Failed → critical
    if (d.status === 'failed') {
      const id = makeId('delegation_failed', d.id)
      if (!existingIds.has(id)) {
        upsertAttentionItem(buildItem(
          'delegation_failed', d,
          `Agent fehlgeschlagen: ${label}`,
          `Delegation "${label}" hat den Status "failed" erreicht. Prüfe die Logs und starte ggf. neu.`,
        ))
      }
    }

    // Approved but stalled (running for too long without new logs)
    if (d.status === 'running') {
      const lastActivity = new Date(d.updatedAt || d.createdAt).getTime()
      const stalled = Date.now() - lastActivity > STALL_THRESHOLD_MS
      const id = makeId('delegation_stalled', d.id)
      if (stalled && !existingIds.has(id)) {
        upsertAttentionItem(buildItem(
          'delegation_stalled', d,
          `Agent hängt: ${label}`,
          `Keine Log-Aktivität seit über 10 Minuten. Möglicherweise steckt der Prozess fest.`,
        ))
      }
    }

    // Budget >90%
    if (d.status === 'running' && d.contract.maxBudgetUsd > 0) {
      const spent = d.actualCostUsd ?? d.costEstimateUsd ?? 0
      const pct = spent / d.contract.maxBudgetUsd
      const id = makeId('budget_exceeded', d.id)
      if (pct >= 0.9 && !existingIds.has(id)) {
        upsertAttentionItem(buildItem(
          'budget_exceeded', d,
          `Budget fast aufgebraucht: ${label}`,
          `${Math.round(pct * 100)}% des Budgets ($${d.contract.maxBudgetUsd}) verbraucht. Erwäge den Agent zu stoppen.`,
        ))
      }
    }

    // Pending approvals
    if (d.status === 'approved') {
      const id = makeId('approval_pending', d.id)
      if (!existingIds.has(id)) {
        upsertAttentionItem(buildItem(
          'approval_pending', d,
          `Bereit zum Start: ${label}`,
          `Delegation ist freigegeben und wartet auf Ausführungsstart.`,
        ))
      }
    }

    // Auto-resolve: if delegation reached terminal state, resolve its open attention items
    if (['completed', 'cancelled'].includes(d.status)) {
      resolveItemsByDelegation(d.id, 'system')
    }
  }
}
