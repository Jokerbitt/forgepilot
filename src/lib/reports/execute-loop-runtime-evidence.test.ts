import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

const { mockAppendExecuteLoopEvidence, mockReadExecuteLoopEvidence } = vi.hoisted(() => ({
  mockAppendExecuteLoopEvidence: vi.fn(),
  mockReadExecuteLoopEvidence: vi.fn(() => [] as unknown[]),
}))

vi.mock('./execute-loop-evidence-store', () => ({
  appendExecuteLoopEvidence: mockAppendExecuteLoopEvidence,
  normalizeEvidenceNotes: (notes?: string) => notes,
  readExecuteLoopEvidence: mockReadExecuteLoopEvidence,
}))

import {
  __test__,
  recordRuntimeExecuteLoopEvidence,
} from './execute-loop-runtime-evidence'

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Small useful ticket',
    status: 'completed',
    executionRoute: 'runner',
    costEstimateUsd: 0.1,
    briefId: 'brief-1',
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-1',
      goal: 'Make a small useful change',
      context: '',
      definitionOfDone: ['Tests pass'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: ['git'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-23T00:00:00.000Z',
    },
    logs: [{ timestamp: '2026-05-23T00:01:00.000Z', type: 'success', message: 'npm run test:run ✓ Tests grün' }],
    summaryReport: {
      keyPoints: ['Done'],
      changes: [],
      timeTakenMinutes: 12,
      prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/999',
      testsPassed: 12,
    },
    criticScore: {
      correctness: 92,
      efficiency: 88,
      drift: 95,
      verdict: 'approved',
      summary: 'Looks good',
      runAt: '2026-05-23T00:02:00.000Z',
    },
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:02:00.000Z',
    ...overrides,
  }
}

describe('execute-loop runtime evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadExecuteLoopEvidence.mockReturnValue([])
  })

  it('marks a fully proven delegation as success when writeback is confirmed', () => {
    const run = __test__.buildRuntimeEvidenceRun(makeDelegation(), { writeback: true })

    expect(run.status).toBe('success')
    expect(run.source).toBe('runtime-aggregate')
    expect(run.steps).toEqual({
      brief: true,
      delegation: true,
      execute: true,
      tests: true,
      pr: true,
      critic: true,
      writeback: true,
    })
    expect(run.prUrl).toBe('https://github.com/Jokerbitt/forgepilot/pull/999')
  })

  it('keeps incomplete real runs as partial instead of pretending success', () => {
    const run = __test__.buildRuntimeEvidenceRun(makeDelegation({
      summaryReport: { keyPoints: [], changes: [], timeTakenMinutes: 1 },
      criticScore: undefined,
    }))

    expect(run.status).toBe('partial')
    expect(run.steps.pr).toBe(false)
    expect(run.steps.critic).toBe(false)
    expect(run.steps.writeback).toBe(false)
  })

  it('records failed delegations as blocked evidence with blocker text', () => {
    const run = __test__.buildRuntimeEvidenceRun(makeDelegation({
      status: 'failed',
      errorMessage: 'Provider unavailable',
    }))

    expect(run.status).toBe('blocked')
    expect(run.blocker).toBe('Provider unavailable')
  })

  it('persists the built runtime evidence', () => {
    const run = recordRuntimeExecuteLoopEvidence(makeDelegation(), { writeback: true })

    expect(mockAppendExecuteLoopEvidence).toHaveBeenCalledWith(expect.objectContaining({
      id: 'runtime-del-1',
      status: 'success',
    }))
    expect(run.id).toBe('runtime-del-1')
  })

  it('merges late writeback evidence with previously recorded PR and critic evidence', () => {
    mockReadExecuteLoopEvidence.mockReturnValue([
      __test__.buildRuntimeEvidenceRun(makeDelegation(), {
        pr: true,
        critic: true,
        notes: 'PR and critic already recorded.',
      }),
    ])

    const staleDelegation = makeDelegation({
      summaryReport: { keyPoints: ['Done'], changes: [], timeTakenMinutes: 12, testsPassed: 12 },
      criticScore: undefined,
    })
    const run = recordRuntimeExecuteLoopEvidence(staleDelegation, {
      writeback: true,
      notes: 'Writeback arrived later.',
    })

    expect(run.status).toBe('success')
    expect(run.steps).toEqual({
      brief: true,
      delegation: true,
      execute: true,
      tests: true,
      pr: true,
      critic: true,
      writeback: true,
    })
    expect(run.prUrl).toBe('https://github.com/Jokerbitt/forgepilot/pull/999')
    expect(run.notes).toContain('PR and critic already recorded.')
    expect(run.notes).toContain('Writeback arrived later.')
    expect(mockAppendExecuteLoopEvidence).toHaveBeenCalledWith(expect.objectContaining({
      id: 'runtime-del-1',
      status: 'success',
      steps: expect.objectContaining({ pr: true, critic: true, writeback: true }),
    }))
  })
})
