import { buildRetryDelegationPatch, buildRetryPlan } from '@/lib/delegations/retry'
import type { Delegation } from '@/lib/models/delegation'
import type { DelegationRepository } from '@/lib/repositories/delegationRepository'
import type { FailedDelegationActionPlan } from './triage-actions'

export interface FailedDelegationAutoTriageResult {
  mode: 'preview' | 'apply'
  attempted: number
  retried: Array<{
    id: string
    title: string
    failureCause: string
    retryCount: number
  }>
  skipped: Array<{
    id: string
    title: string
    reason: string
  }>
  nextAction: string
}

export async function applyFailedDelegationAutoTriage(input: {
  repo: DelegationRepository
  failedDelegations: Delegation[]
  actionPlan: FailedDelegationActionPlan
  mode: 'preview' | 'apply'
  now?: Date
}): Promise<FailedDelegationAutoTriageResult> {
  const now = input.now ?? new Date()
  const byId = new Map(input.failedDelegations.map(delegation => [delegation.id, delegation]))
  const retried: FailedDelegationAutoTriageResult['retried'] = []
  const skipped: FailedDelegationAutoTriageResult['skipped'] = []

  for (const id of input.actionPlan.retryableIds) {
    const delegation = byId.get(id)
    if (!delegation) {
      skipped.push({ id, title: id, reason: 'Delegation nicht mehr im failed Status gefunden.' })
      continue
    }

    const plan = buildRetryPlan(delegation)
    if (!plan.shouldRetry) {
      skipped.push({ id, title: delegation.title, reason: plan.diagnosticMessage })
      continue
    }

    if (input.mode === 'apply') {
      await input.repo.update(id, buildRetryDelegationPatch(delegation, plan, now))
    }

    retried.push({
      id,
      title: delegation.title,
      failureCause: plan.failureCause,
      retryCount: plan.retryCount + 1,
    })
  }

  return {
    mode: input.mode,
    attempted: input.actionPlan.retryableIds.length,
    retried,
    skipped,
    nextAction: buildAutoTriageNextAction(input.mode, retried.length, skipped.length),
  }
}

function buildAutoTriageNextAction(mode: 'preview' | 'apply', retried: number, skipped: number): string {
  if (mode === 'preview') {
    return retried > 0
      ? `${retried} sichere Retry-Kandidat(en) gefunden. Mit mode=apply ausfuehren.`
      : 'Keine sichere Auto-Retry-Kandidaten gefunden; manuelle Triage bleibt erforderlich.'
  }

  if (retried > 0) {
    return `${retried} Delegation(en) wurden auf pending gesetzt. Danach Queue starten und Live View beobachten.`
  }

  if (skipped > 0) {
    return 'Keine Delegation wurde geaendert; pruefe die Skip-Gruende.'
  }

  return 'Keine Aktion erforderlich.'
}
