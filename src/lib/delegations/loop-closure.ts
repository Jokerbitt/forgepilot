/**
 * loop-closure.ts — Closes the autonomous assistant loop.
 *
 * Handles automatic transitions between loop steps:
 *   Execute → Quality Check → Auto-Repair → Next Task → Plan Complete
 *
 * In autopilot mode these transitions happen without user input.
 * In balanced/manual mode they suggest the next step with one-click CTAs.
 */

import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import type { Delegation, DoDQualityCheck } from '@/lib/models/delegation'

// ─── Auto-Repair ─────────────────────────────────────────────────────────────

/**
 * Called after a quality check completes with verdict 'failed' or 'partial'.
 * In autopilot mode: automatically creates and starts a Review-Retry delegation.
 * In balanced mode: just logs that repair is available.
 */
export async function scheduleAutoRepair(
  delegation: Delegation,
  qualityCheck: DoDQualityCheck,
): Promise<{ scheduled: boolean; repairDelegationId?: string }> {
  const config = getNBAConfig()

  // Only auto-repair in autopilot mode, for Risk A/B, and max 2 retries
  const isAutopilot = config.approvalMode === 'autopilot'
  const retryCount = delegation.retryCount ?? 0
  const riskOk = delegation.contract.riskClass !== 'C'

  if (!isAutopilot || !riskOk || retryCount >= 2 || qualityCheck.verdict === 'passed') {
    return { scheduled: false }
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  // Build review context from failed criteria
  const failedCriteria = qualityCheck.criteria.filter(c => !c.met)
  const reviewContext = [
    delegation.contract.context?.trim() ?? '',
    '\n## Review Feedback (Auto-Repair)',
    ...failedCriteria.map(c => `- **${c.item}**: ${c.notes || 'Nicht erfüllt'}`),
    qualityCheck.suggestion ? `\n**Verbesserungsvorschlag:** ${qualityCheck.suggestion}` : '',
    `\n**Retry ${retryCount + 1}/2 — Auto-generiert durch Loop-Closure**`,
  ].filter(Boolean).join('\n')

  const repairDelegation: Omit<Delegation, 'id' | 'createdAt' | 'updatedAt'> = {
    title: `[Auto-Fix ${retryCount + 1}/2] ${delegation.title || delegation.contract.goal}`,
    status: 'approved', // auto-approved for execution
    executionRoute: delegation.executionRoute,
    costEstimateUsd: delegation.costEstimateUsd,
    logs: [{
      timestamp: new Date().toISOString(),
      type: 'info',
      message: `Auto-Repair ${retryCount + 1}/2 durch Loop-Closure erstellt. Ursprung: ${delegation.id}`,
    }],
    tags: [
      ...(delegation.tags ?? []).filter(t => !t.startsWith('auto-repair-of:')),
      `auto-repair-of:${delegation.id}`,
    ],
    chainedFromId: delegation.id,
    retryCount: retryCount + 1,
    contract: {
      ...delegation.contract,
      goal: delegation.contract.goal,
      context: reviewContext,
      requiresApproval: false,
    },
    targetRepo: delegation.targetRepo,
  }

  const created = await repo.create(repairDelegation as Delegation)

  // Log on original delegation
  await repo.update(delegation.id, {
    logs: [
      ...(delegation.logs ?? []),
      {
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `🔁 Auto-Repair ${retryCount + 1}/2 gestartet → Delegation ${created.id}`,
      },
    ],
  })

  // Auto-start execution via internal call
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    fetch(`${baseUrl}/api/delegations/${created.id}/execute`, { method: 'POST' }).catch(() => {})
  } catch { /* non-critical */ }

  return { scheduled: true, repairDelegationId: created.id }
}

// ─── Plan Completion Check ────────────────────────────────────────────────────

export interface LoopStats {
  total: number
  completed: number
  failed: number
  running: number
  pending: number
  allDone: boolean
  successRate: number | null
}

/**
 * Compute loop statistics for the current day or a specific plan.
 */
export async function computeLoopStats(): Promise<LoopStats> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const all = await repo.listByStatus()

  const today = new Date().toISOString().slice(0, 10)
  const todayDelegations = all.filter(d =>
    d.createdAt?.startsWith(today) || d.updatedAt?.startsWith(today),
  )

  const counts = {
    completed: todayDelegations.filter(d => d.status === 'completed').length,
    failed: todayDelegations.filter(d => d.status === 'failed').length,
    running: todayDelegations.filter(d => d.status === 'running').length,
    pending: todayDelegations.filter(d => ['pending', 'approved'].includes(d.status)).length,
    total: todayDelegations.length,
  }

  const done = counts.completed + counts.failed
  const successRate = done > 0 ? Math.round((counts.completed / done) * 100) : null

  return {
    ...counts,
    allDone: counts.running === 0 && counts.pending === 0 && done > 0,
    successRate,
  }
}

// ─── Next Action ──────────────────────────────────────────────────────────────

export interface NextLoopAction {
  type: 'start-delegation' | 'review-failed' | 'check-pr' | 'all-done' | 'idle'
  delegationId?: string
  title?: string
  label: string
  detail: string
  href: string
  urgent: boolean
}

/**
 * Determines the single most important next action in the autonomous loop.
 * Returns ONE concrete action — not a list.
 */
export async function getNextLoopAction(): Promise<NextLoopAction> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const all = await repo.listByStatus()

  // Priority 1: Failed delegations that need attention
  const failed = all.filter(d => d.status === 'failed')
  if (failed.length > 0) {
    const top = failed[0]
    return {
      type: 'review-failed',
      delegationId: top.id,
      title: top.title ?? top.contract.goal,
      label: `${failed.length} fehlgeschlagen`,
      detail: top.errorMessage ?? 'Delegation fehlgeschlagen — Fehler analysieren',
      href: `/delegations/${top.id}`,
      urgent: true,
    }
  }

  // Priority 2: Running delegations (just monitor)
  const running = all.filter(d => d.status === 'running')
  if (running.length > 0) {
    return {
      type: 'review-failed',
      delegationId: running[0].id,
      label: `${running.length} laufen gerade`,
      detail: `Agent arbeitet an: ${running[0].title ?? running[0].contract.goal}`,
      href: '/live',
      urgent: false,
    }
  }

  // Priority 3: Approved delegations ready to start
  const approved = all.filter(d => d.status === 'approved')
  if (approved.length > 0) {
    const top = approved[0]
    return {
      type: 'start-delegation',
      delegationId: top.id,
      title: top.title ?? top.contract.goal,
      label: 'Bereit zum Starten',
      detail: `"${(top.title ?? top.contract.goal).slice(0, 80)}" — freigegeben, wartet auf Ausführung`,
      href: `/delegations/${top.id}`,
      urgent: false,
    }
  }

  // Priority 4: Pending delegations needing approval
  const pending = all.filter(d => d.status === 'pending')
  if (pending.length > 0) {
    const top = pending[0]
    return {
      type: 'start-delegation',
      delegationId: top.id,
      label: `${pending.length} warten auf Freigabe`,
      detail: `"${(top.title ?? top.contract.goal).slice(0, 80)}"`,
      href: '/delegations?status=pending',
      urgent: false,
    }
  }

  // Priority 5: Completed PRs waiting for review
  const withOpenPR = all.filter(d =>
    d.status === 'completed' &&
    d.summaryReport?.prUrl &&
    d.summaryReport.prState === 'open',
  )
  if (withOpenPR.length > 0) {
    return {
      type: 'check-pr',
      delegationId: withOpenPR[0].id,
      label: `${withOpenPR.length} PR${withOpenPR.length > 1 ? 's' : ''} offen`,
      detail: 'Pull Requests prüfen und mergen',
      href: '/delegations?status=completed',
      urgent: false,
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const completedToday = all.filter(d =>
    d.status === 'completed' && d.completedAt?.startsWith(today),
  ).length

  if (completedToday > 0) {
    return {
      type: 'all-done',
      label: 'Alles erledigt heute',
      detail: `${completedToday} Task${completedToday > 1 ? 's' : ''} heute abgeschlossen`,
      href: '/delegations/plan',
      urgent: false,
    }
  }

  return {
    type: 'idle',
    label: 'Keine aktiven Tasks',
    detail: 'Plan Mode starten um eine neue Aufgabe zu planen',
    href: '/delegations/plan',
    urgent: false,
  }
}
