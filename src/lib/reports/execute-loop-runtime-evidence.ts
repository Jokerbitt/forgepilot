import type { Delegation } from '@/lib/models/delegation'
import type { DailyReportExecuteLoopEvidenceRun } from './daily-report'
import { appendExecuteLoopEvidence, readExecuteLoopEvidence } from './execute-loop-evidence-store'

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

function mergeRuntimeEvidenceRun(
  next: DailyReportExecuteLoopEvidenceRun,
  previous?: DailyReportExecuteLoopEvidenceRun,
): DailyReportExecuteLoopEvidenceRun {
  if (!previous || previous.id !== next.id) return next

  const steps = {
    brief: previous.steps.brief || next.steps.brief,
    delegation: previous.steps.delegation || next.steps.delegation,
    execute: previous.steps.execute || next.steps.execute,
    tests: previous.steps.tests || next.steps.tests,
    pr: previous.steps.pr || next.steps.pr,
    critic: previous.steps.critic || next.steps.critic,
    writeback: previous.steps.writeback || next.steps.writeback,
  }

  const complete = Object.values(steps).every(Boolean)
  const blocked = next.status === 'blocked' || previous.status === 'blocked'

  return {
    ...previous,
    ...next,
    recordedAt: next.recordedAt,
    prUrl: next.prUrl ?? previous.prUrl,
    blocker: next.blocker ?? previous.blocker,
    notes: [previous.notes, next.notes]
      .filter(Boolean)
      .filter((note, index, all) => all.indexOf(note) === index)
      .join(' | ') || undefined,
    steps,
    status: complete ? 'success' : blocked ? 'blocked' : 'partial',
  }
}

export function recordRuntimeExecuteLoopEvidence(
  delegation: Delegation,
  options: RuntimeEvidenceOptions = {},
): DailyReportExecuteLoopEvidenceRun {
  const next = buildRuntimeEvidenceRun(delegation, options)
  const previous = readExecuteLoopEvidence().find(run => run.id === next.id)
  const run = mergeRuntimeEvidenceRun(next, previous)
  appendExecuteLoopEvidence(run)
  return run
}

export const __test__ = {
  buildRuntimeEvidenceRun,
  mergeRuntimeEvidenceRun,
}
