export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import {
  buildDailyAssistantAction,
  buildDailyAssistantBlockers,
  buildDailyAssistantSteps,
  describeAutonomy,
  sortAssistantQueue,
  type DailyAssistantInput,
  type DailyAssistantQueueItem,
} from '@/lib/daily-assistant/next-action'
import { buildAppBuilderCapability } from '@/lib/daily-assistant/app-builder'
import { buildAssistantRoadmap } from '@/lib/daily-assistant/roadmap'
import { getAutopilotReadiness } from '@/lib/autopilot/readiness'
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
  }

  const action = buildDailyAssistantAction(input)
  const steps = buildDailyAssistantSteps(input)
  const blockers = buildDailyAssistantBlockers(input, queue)
  const autopilot = getAutopilotReadiness()
  const appBuilder = buildAppBuilderCapability({ assistant: input, queue, autopilot })
  const roadmap = buildAssistantRoadmap({ assistant: input, queue, autopilot, appBuilder })

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    status: action.tone,
    readinessScore: computeReadiness(input),
    action,
    autonomyText: describeAutonomy(input),
    appBuilder,
    roadmap,
    autopilot,
    steps,
    blockers,
    queue,
    stats,
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
