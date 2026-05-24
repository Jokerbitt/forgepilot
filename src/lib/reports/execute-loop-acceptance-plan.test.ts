import { describe, expect, it } from 'vitest'
import type { DailyReportExecuteLoopEvidenceRun } from './daily-report'
import { buildExecuteLoopAcceptancePlan } from './execute-loop-acceptance-plan'

function run(overrides: Partial<DailyReportExecuteLoopEvidenceRun> = {}): DailyReportExecuteLoopEvidenceRun {
  return {
    id: 'run-1',
    title: 'Kleiner Bugfix: leere Zustandsmeldung verbessern',
    status: 'success',
    source: 'manual',
    recordedAt: '2026-05-24T12:00:00.000Z',
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

describe('execute-loop acceptance plan', () => {
  it('starts with a bugfix when no proven runs exist', () => {
    const plan = buildExecuteLoopAcceptancePlan([])

    expect(plan).toHaveLength(5)
    expect(plan[0].status).toBe('next')
    expect(plan[0].category).toBe('bugfix')
    expect(plan[1].status).toBe('queued')
  })

  it('marks matching proven runs as done and advances the next recommendation', () => {
    const plan = buildExecuteLoopAcceptancePlan([run()])

    expect(plan[0].status).toBe('done')
    expect(plan[1].status).toBe('next')
    expect(plan[1].category).toBe('feature')
  })

  it('ignores dry-run records for done status', () => {
    const plan = buildExecuteLoopAcceptancePlan([run({ source: 'harness-dry-run' })])

    expect(plan[0].status).toBe('next')
  })
})
