import type { DailyReportExecuteLoopEvidenceRun } from './daily-report'
import {
  buildExecuteLoopAcceptancePlan,
  type ExecuteLoopAcceptancePlanItem,
} from './execute-loop-acceptance-plan'

export interface ExecuteLoopEvidenceSummary {
  targetRuns: number
  totalRuns: number
  provenRuns: number
  dryRuns: number
  blockedRuns: number
  partialRuns: number
  progressPct: number
  currentStatus: 'not-started' | 'collecting' | 'proven' | 'blocked'
  nextAction: string
  releaseGate: {
    ready: boolean
    requiredProvenRuns: number
    remainingProvenRuns: number
    reason: string
  }
  recommendedRuns: ExecuteLoopAcceptancePlanItem[]
}

export function isProvenExecuteLoopRun(run: DailyReportExecuteLoopEvidenceRun): boolean {
  return run.source !== 'harness-dry-run'
    && run.status === 'success'
    && run.steps.brief
    && run.steps.delegation
    && run.steps.execute
    && run.steps.tests
    && run.steps.pr
    && run.steps.critic
    && run.steps.writeback
}

export function buildExecuteLoopEvidenceSummary(
  runs: DailyReportExecuteLoopEvidenceRun[],
  targetRuns = 5,
): ExecuteLoopEvidenceSummary {
  const provenRuns = runs.filter(isProvenExecuteLoopRun).length
  const dryRuns = runs.filter(run => run.source === 'harness-dry-run').length
  const realRuns = runs.filter(run => run.source !== 'harness-dry-run')
  const blockedRuns = realRuns.filter(run => run.status === 'blocked').length
  const partialRuns = realRuns.filter(run => run.status === 'partial').length
  const remainingProvenRuns = Math.max(targetRuns - provenRuns, 0)
  const progressPct = targetRuns <= 0 ? 100 : Math.round((provenRuns / targetRuns) * 100)
  const currentStatus: ExecuteLoopEvidenceSummary['currentStatus'] =
    provenRuns >= targetRuns ? 'proven'
    : blockedRuns > 0 && provenRuns === 0 ? 'blocked'
    : runs.length > 0 ? 'collecting'
    : 'not-started'

  const nextAction = remainingProvenRuns === 0
    ? 'Summarize V1 readiness and decide whether ForgePilot is ready for daily use.'
    : `Run and record ${remainingProvenRuns} more real small ticket loop${remainingProvenRuns === 1 ? '' : 's'} with PR, critic review and writeback evidence.`

  return {
    targetRuns,
    totalRuns: runs.length,
    provenRuns,
    dryRuns,
    blockedRuns,
    partialRuns,
    progressPct,
    currentStatus,
    nextAction,
    releaseGate: {
      ready: remainingProvenRuns === 0,
      requiredProvenRuns: targetRuns,
      remainingProvenRuns,
      reason: remainingProvenRuns === 0
        ? 'Enough real value loops are proven for a V1 readiness review.'
        : `${remainingProvenRuns} proven real value loop${remainingProvenRuns === 1 ? '' : 's'} still required before claiming productive reliability.`,
    },
    recommendedRuns: buildExecuteLoopAcceptancePlan(runs, targetRuns),
  }
}
