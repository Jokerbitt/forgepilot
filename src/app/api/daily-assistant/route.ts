export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import {
  buildAppBuilderCapability,
  buildDailyAssistantAction,
  buildDailyAssistantBlockers,
  buildDailyAssistantSteps,
  describeAutonomy,
  sortAssistantQueue,
  type DailyAssistantInput,
  type DailyAssistantQueueItem,
} from '@/lib/daily-assistant/next-action'
import type { Delegation } from '@/lib/models/delegation'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import {
  createDelegationRepository,
  getDelegationStorageMode,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'

function countByStatus(delegations: Delegation[]) {
  const byStatus: Record<string, number> = {}
  let prOpen = 0
  let prMerged = 0

  for (const delegation of delegations) {
    byStatus[delegation.status] = (byStatus[delegation.status] ?? 0) + 1
    if (delegation.summaryReport?.prUrl) {
      if (delegation.summaryReport.prState === 'merged') prMerged++
      else if (!delegation.summaryReport.prState || delegation.summaryReport.prState === 'open') prOpen++
    }
  }

  return {
    total: delegations.length,
    pending: byStatus.pending ?? 0,
    approved: byStatus.approved ?? 0,
    running: byStatus.running ?? 0,
    completed: byStatus.completed ?? 0,
    failed: byStatus.failed ?? 0,
    cancelled: byStatus.cancelled ?? 0,
    prOpen,
    prMerged,
  }
}

function computeTodayStats(delegations: Delegation[]) {
  const today = new Date().toISOString().slice(0, 10)
  const completedToday = delegations.filter(
    d => d.status === 'completed' && d.completedAt?.startsWith(today),
  ).length
  const prToday = delegations.filter(
    d => d.summaryReport?.prUrl && d.completedAt?.startsWith(today),
  ).length
  const checksWithVerdict = delegations.filter(d => d.qualityCheck?.verdict)
  const passed = checksWithVerdict.filter(d => d.qualityCheck?.verdict === 'passed').length
  const qualityPassRate = checksWithVerdict.length > 0
    ? Math.round((passed / checksWithVerdict.length) * 100)
    : null
  return { completedToday, prToday, qualityPassRate, checksTotal: checksWithVerdict.length }
}

function toQueueItem(delegation: Delegation): DailyAssistantQueueItem {
  return {
    id: delegation.id,
    title: delegation.title || delegation.contract.goal || delegation.id,
    status: delegation.status,
    riskClass: delegation.contract.riskClass,
    requiresApproval: delegation.contract.requiresApproval,
    updatedAt: delegation.updatedAt,
  }
}

function computeReadiness(input: DailyAssistantInput): number {
  let score = 100
  score -= Math.min(input.failed * 25, 50)
  score -= Math.min(input.prOpen * 8, 16)
  if (input.authDisabled) score -= 12
  if (input.storageMode === 'json') score -= 10
  if (input.running > 0) score -= 4
  return Math.max(0, Math.min(100, score))
}

export async function GET() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const config = getNBAConfig()
  const delegations = await repo.listByStatus()
  const stats = countByStatus(delegations)
  const queue = sortAssistantQueue(
    delegations
      .filter(delegation => ['failed', 'running', 'approved', 'pending'].includes(delegation.status))
      .map(toQueueItem),
  ).slice(0, 8)

  const input: DailyAssistantInput = {
    pending: stats.pending,
    approved: stats.approved,
    running: stats.running,
    failed: stats.failed,
    prOpen: stats.prOpen,
    prMerged: stats.prMerged,
    authDisabled: process.env.FORGEPILOT_AUTH_DISABLED === 'true',
    storageMode: getDelegationStorageMode(process.env),
    approvalMode: config.approvalMode,
    completedCount: stats.completed,
  }

  const action = buildDailyAssistantAction(input)
  const steps = buildDailyAssistantSteps(input)
  const blockers = buildDailyAssistantBlockers(input, queue)
  const appBuilderCapability = buildAppBuilderCapability(input)
  const todayStats = computeTodayStats(delegations)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    status: action.tone,
    readinessScore: computeReadiness(input),
    action,
    autonomyText: describeAutonomy(input),
    steps,
    blockers,
    queue,
    stats,
    todayStats,
    appBuilderCapability,
    settings: {
      approvalMode: config.approvalMode,
      autopilotMinScore: config.autopilotMinScore,
      autopilotMaxRiskClass: config.autopilotMaxRiskClass,
      maxConcurrentAgents: config.maxConcurrentAgents,
    },
  }, {
    headers: { 'cache-control': 'no-store' },
  })
}
