import { describe, it, expect } from 'vitest'
import { formatCompletedDuration } from '@/components/shared/ElapsedTimer'
import type { Delegation } from '@/lib/models/delegation'

function makeTimestamps(startOffsetMs: number, durationMs: number) {
  const startedAt = new Date(1_000_000_000_000 + startOffsetMs).toISOString()
  const completedAt = new Date(1_000_000_000_000 + startOffsetMs + durationMs).toISOString()
  return { startedAt, completedAt }
}

describe('Delegation duration fields', () => {
  it('Delegation type accepts startedAt and completedAt', () => {
    const d: Partial<Delegation> = {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    expect(d.startedAt).toBeTruthy()
    expect(d.completedAt).toBeTruthy()
  })

  it('formatCompletedDuration returns <1 min for sub-minute executions', () => {
    const { startedAt, completedAt } = makeTimestamps(0, 45_000)
    expect(formatCompletedDuration(startedAt, completedAt)).toBe('<1 min')
  })

  it('formatCompletedDuration returns correct minutes', () => {
    const { startedAt, completedAt } = makeTimestamps(0, 3 * 60_000)
    expect(formatCompletedDuration(startedAt, completedAt)).toBe('3 min')
  })

  it('formatCompletedDuration returns 1 min for exactly 60s', () => {
    const { startedAt, completedAt } = makeTimestamps(0, 60_000)
    expect(formatCompletedDuration(startedAt, completedAt)).toBe('1 min')
  })

  it('formatCompletedDuration handles long executions', () => {
    const { startedAt, completedAt } = makeTimestamps(0, 45 * 60_000)
    expect(formatCompletedDuration(startedAt, completedAt)).toBe('45 min')
  })
})
