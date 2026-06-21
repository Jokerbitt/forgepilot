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
import { generateDailyBriefing, generateFallbackBriefing } from '@/lib/daily-assistant/briefing-generator'
import { buildAppBuilderCapability } from '@/lib/daily-assistant/app-builder'
import { buildAssistantRoadmap } from '@/lib/daily-assistant/roadmap'
import { buildQueueHygieneSummary } from '@/lib/daily-assistant/queue-hygiene'
import { buildProjectPipelineSummary } from '@/lib/daily-assistant/project-pipeline'
import { describeDeliveryAction, pickNextDeliveryAction, type DeliveryCycleAction } from '@/lib/daily-assistant/delivery-cycle'
import { findExistingRepairDelegation } from '@/lib/daily-assistant/repair-delegation'
import { getAutopilotReadiness } from '@/lib/autopilot/readiness'
import type { Delegation } from '@/lib/models/delegation'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import { readProjectBriefs } from '@/lib/project-briefs'
import { readWorkPackages } from '@/lib/knowledge/milestone-store'
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

function deliveryActionPayload(action: DeliveryCycleAction | null) {
  if (!action) return null
  return {
    type: action.type,
    label: describeDeliveryAction(action),
    reason: action.reason,
    delegation: {
      id: action.delegation.id,
      title: action.delegation.title || action.delegation.contract.goal,
      href: `/delegations/${action.delegation.id}`,
      prUrl: action.delegation.summaryReport?.prUrl,
      riskClass: action.delegation.contract.riskClass,
    },
  }
}

export async function GET() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const config = getNBAConfig()
  const delegations = await repo.listByStatus()
  const stats = countByStatus(delegations)
  const rawQueue = sortAssistantQueue(
    delegations
      .filter(delegation => ['failed', 'running', 'approved', 'pending'].includes(delegation.status))
      .map(toQueueItem),
  )
  const queueHygiene = buildQueueHygieneSummary(rawQueue, { maxVisible: 6 })
  const queue = queueHygiene.visibleItems

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
  const autopilot = getAutopilotReadiness()
  const projectPipeline = buildProjectPipelineSummary({
    briefs: readProjectBriefs(),
    workPackages: readWorkPackages(),
    delegations,
  })
  const appBuilder = buildAppBuilderCapability({ assistant: input, queue, autopilot, projectPipeline })
  const roadmap = buildAssistantRoadmap({ assistant: input, queue, autopilot, appBuilder })
  const deliveryAction = pickNextDeliveryAction(delegations)
  const repairDelegation = deliveryAction?.type === 'repair_required'
    ? await findExistingRepairDelegation(repo, deliveryAction.delegation)
    : null

  // Our addition: today stats + AI morning briefing
  const todayStats = computeTodayStats(delegations)
  const briefingInput = {
    pending: stats.pending,
    approved: stats.approved,
    running: stats.running,
    failed: stats.failed,
    completedToday: todayStats.completedToday,
    prOpen: stats.prOpen,
    qualityPassRate: todayStats.qualityPassRate,
    topPendingGoal: queue[0]?.title,
  }
  let briefing: string
  try {
    briefing = await generateDailyBriefing(briefingInput)
  } catch {
    briefing = generateFallbackBriefing(briefingInput)
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    status: action.tone,
    readinessScore: computeReadiness(input),
    action,
    autonomyText: describeAutonomy(input),
    briefing,
    appBuilder,
    roadmap,
    autopilot,
    steps,
    blockers,
    queue,
    queueHygiene,
    projectPipeline,
    deliveryGate: {
      status: deliveryAction?.type === 'repair_required'
        ? 'blocked'
        : deliveryAction
          ? 'attention'
          : 'ready',
      message: describeDeliveryAction(deliveryAction),
      action: deliveryActionPayload(deliveryAction),
      repairDelegation: repairDelegation
        ? {
            id: repairDelegation.id,
            title: repairDelegation.title || repairDelegation.contract.goal,
            href: `/delegations/${repairDelegation.id}`,
            status: repairDelegation.status,
            riskClass: repairDelegation.contract.riskClass,
          }
        : null,
    },
    stats,
    todayStats,
    appBuilderCapability: appBuilder,
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
