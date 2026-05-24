import { describe, expect, it } from 'vitest'
import type { DailyReportExecuteLoopEvidenceRun } from './daily-report'
import {
  buildExecuteLoopEvidenceSummary,
  isProvenExecuteLoopRun,
} from './execute-loop-evidence-summary'

function run(overrides: Partial<DailyReportExecuteLoopEvidenceRun> = {}): DailyReportExecuteLoopEvidenceRun {
  return {
    id: 'run-1',
    title: 'Real value loop',
    status: 'success',
    source: 'manual',
    recordedAt: '2026-05-23T10:00:00.000Z',
    steps: {
      brief: true,
      delegation: true,
      execute: true,
      tests: true,
      pr: true,
      critic: true,
      writeback: true,
    },
    ...overrides,
  }
}

describe('execute-loop evidence summary', () => {
  it('counts only complete non-harness runs as proven', () => {
    expect(isProvenExecuteLoopRun(run())).toBe(true)
    expect(isProvenExecuteLoopRun(run({ source: 'harness-dry-run' }))).toBe(false)
    expect(isProvenExecuteLoopRun(run({ steps: { ...run().steps, writeback: false } }))).toBe(false)
  })

  it('keeps the release gate closed until five proven real runs exist', () => {
    const summary = buildExecuteLoopEvidenceSummary([
      run({ id: 'proven-1' }),
      run({ id: 'dry-run', source: 'harness-dry-run' }),
      run({ id: 'partial-run', status: 'partial', steps: { ...run().steps, pr: false } }),
    ])

    expect(summary.provenRuns).toBe(1)
    expect(summary.dryRuns).toBe(1)
    expect(summary.partialRuns).toBe(1)
    expect(summary.progressPct).toBe(20)
    expect(summary.releaseGate.ready).toBe(false)
    expect(summary.releaseGate.remainingProvenRuns).toBe(4)
    expect(summary.nextAction).toContain('4 more real small ticket loops')
    expect(summary.recommendedRuns).toHaveLength(5)
    expect(summary.recommendedRuns.find(item => item.status === 'next')?.category).toBe('bugfix')
  })

  it('opens the release gate when the target number of real runs is proven', () => {
    const runs = Array.from({ length: 5 }, (_, index) => run({ id: `proven-${index}` }))
    const summary = buildExecuteLoopEvidenceSummary(runs)

    expect(summary.currentStatus).toBe('proven')
    expect(summary.progressPct).toBe(100)
    expect(summary.releaseGate.ready).toBe(true)
    expect(summary.nextAction).toContain('V1 readiness')
    expect(summary.recommendedRuns.every(item => item.status !== 'next')).toBe(true)
  })
})
