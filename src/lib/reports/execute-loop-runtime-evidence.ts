import type { Delegation } from '@/lib/models/delegation'
import type { DailyReportExecuteLoopEvidenceRun } from './daily-report'
import { appendExecuteLoopEvidence } from './execute-loop-evidence-store'

export interface RuntimeEvidenceOptions {
  tests?: boolean
  pr?: boolean
  critic?: boolean
  writeback?: boolean
  notes?: string
  blocker?: string
}

function hasTestEvidence(delegation: Delegation): boolean {
  if ((delegation.summaryReport?.testsPassed ?? 0) > 0) return true
  const text = (delegation.logs ?? []).map(log => log.message).join('\n').toLowerCase()
  return /\b(npm run test|vitest|playwright|tests? gr[üu]n|tests? pass|✓ tests?)\b/.test(text)
}

function buildRuntimeEvidenceRun(
  delegation: Delegation,
  options: RuntimeEvidenceOptions = {},
): DailyReportExecuteLoopEvidenceRun {
  const execute = delegation.status === 'completed' || delegation.status === 'failed'
  const tests = options.tests ?? hasTestEvidence(delegation)
  const pr = options.pr ?? Boolean(delegation.summaryReport?.prUrl)
  const critic = options.critic ?? Boolean(delegation.criticScore)
  const writeback = options.writeback ?? false

  const steps = {
    brief: Boolean(delegation.briefId || delegation.briefTitle),
    delegation: true,
    execute,
    tests,
    pr,
    critic,
    writeback,
  }

  const complete = Object.values(steps).every(Boolean)
  const blocked = delegation.status === 'failed' || Boolean(options.blocker)

  return {
    id: `runtime-${delegation.id}`,
    title: delegation.title || delegation.contract.goal.slice(0, 120),
    status: complete ? 'success' : blocked ? 'blocked' : 'partial',
    source: 'runtime-aggregate',
    recordedAt: new Date().toISOString(),
    delegationId: delegation.id,
    briefId: delegation.briefId,
    prUrl: delegation.summaryReport?.prUrl,
    manualInterventions: delegation.retryCount,
    blocker: options.blocker ?? delegation.errorMessage,
    notes: options.notes ?? 'Automatically derived from delegation runtime signals.',
    steps,
  }
}

export function recordRuntimeExecuteLoopEvidence(
  delegation: Delegation,
  options: RuntimeEvidenceOptions = {},
): DailyReportExecuteLoopEvidenceRun {
  const run = buildRuntimeEvidenceRun(delegation, options)
  appendExecuteLoopEvidence(run)
  return run
}

export const __test__ = {
  buildRuntimeEvidenceRun,
}
