import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentRun } from '@/lib/models/agent-run'

vi.mock('@/lib/knowledge/store', () => ({
  upsertCard: vi.fn(c => c),
}))

import * as store from '@/lib/knowledge/store'
import { writeRunLessons } from './lessons'

function baseRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 'run-abc12345-0000-0000-0000-000000000000',
    delegationId: 'del-1',
    contractId: 'con-1',
    status: 'completed',
    model: 'claude-sonnet-4-6',
    startedAt: '2026-05-18T00:00:00Z',
    completedAt: '2026-05-18T00:01:00Z',
    totalCostUsd: 0.05,
    tokenInput: 1000,
    tokenOutput: 500,
    traceEvents: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(store.upsertCard).mockImplementation(c => c)
})

describe('writeRunLessons', () => {
  it('returns no cards for running status', () => {
    const result = writeRunLessons(baseRun({ status: 'running' }))
    expect(result.cards).toHaveLength(0)
    expect(store.upsertCard).not.toHaveBeenCalled()
  })

  it('creates a learning card for completed run with summary', () => {
    const run = baseRun({ resultSummary: 'Successfully implemented the feature.' })
    const result = writeRunLessons(run)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].type).toBe('learning')
    expect(result.cards[0].tags).toContain('learning')
    expect(store.upsertCard).toHaveBeenCalledOnce()
  })

  it('creates no card for completed run without summary', () => {
    const result = writeRunLessons(baseRun({ status: 'completed' }))
    expect(result.cards).toHaveLength(0)
  })

  it('creates a risk card for failed run', () => {
    const run = baseRun({ status: 'failed', errorMessage: 'Policy check denied the action.' })
    const result = writeRunLessons(run)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].type).toBe('risk')
    expect(result.cards[0].body).toContain('Policy check denied')
    expect(result.cards[0].tags).toContain('risk')
  })

  it('creates both learning and risk cards when completed run has error trace events', () => {
    const run = baseRun({
      status: 'completed',
      resultSummary: 'Finished with warnings.',
      traceEvents: [{
        id: 'ev-1', agentRunId: 'run-abc12345-0000-0000-0000-000000000000',
        type: 'error', timestamp: '2026-05-18T00:00:30Z',
        data: { message: 'Tool call failed but recovered.' },
      }],
    })
    const result = writeRunLessons(run)
    expect(result.cards).toHaveLength(2)
    const types = result.cards.map(c => c.type)
    expect(types).toContain('learning')
    expect(types).toContain('risk')
  })

  it('card id is deterministic per run id', () => {
    const run = baseRun({ resultSummary: 'Done.' })
    const r1 = writeRunLessons(run)
    vi.mocked(store.upsertCard).mockClear()
    const r2 = writeRunLessons(run)
    expect(r1.cards[0].id).toBe(r2.cards[0].id)
  })

  it('includes model name in tags', () => {
    const run = baseRun({ status: 'failed', errorMessage: 'Failed.' })
    const result = writeRunLessons(run)
    expect(result.cards[0].tags).toContain('claude-sonnet-4-6')
  })
})
