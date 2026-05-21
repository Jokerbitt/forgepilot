import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import type { GrokCriticResult } from './grok-critic'

const { mockRunGrokCritic, mockRepoUpdate } = vi.hoisted(() => ({
  mockRunGrokCritic: vi.fn(),
  mockRepoUpdate: vi.fn(),
}))

vi.mock('./grok-critic', () => ({
  runGrokCritic: mockRunGrokCritic,
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: () => ({
    update: mockRepoUpdate,
  }),
  SINGLE_TENANT_USER_ID: 'local-user',
}))

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: '0f7777d2-3ce6-4d0f-9087-b6ac6079668d',
    title: 'Add auth guard',
    status: 'completed',
    executionRoute: 'runner',
    costEstimateUsd: 1,
    createdAt: '2026-05-21T10:00:00.000Z',
    updatedAt: '2026-05-21T10:10:00.000Z',
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-1',
      goal: 'Protect all delegation API routes with auth',
      context: '',
      definitionOfDone: ['Routes require auth', 'Tests cover unauthorized access'],
      riskClass: 'B',
      maxBudgetUsd: 2,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: true,
      privacyMode: 'private-cloud',
      createdAt: '2026-05-21T10:00:00.000Z',
    },
    summaryReport: {
      keyPoints: ['Added route guards'],
      changes: ['Updated API routes'],
      filesModified: ['src/app/api/delegations/route.ts'],
      timeTakenMinutes: 12,
    },
    ...overrides,
  }
}

function makeGrokResult(overrides: Partial<GrokCriticResult> = {}): GrokCriticResult {
  return {
    correctnessScore: 91,
    efficiencyScore: 84,
    driftScore: 97,
    overallGrade: 'A',
    criteriaHit: [true, true],
    issues: [],
    verdict: 'PASS',
    reason: 'The implementation meets the criteria and stays in scope.',
    providerId: 'xai',
    evaluatedAt: '2026-05-21T10:15:00.000Z',
    ...overrides,
  }
}

describe('auto Grok critic persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps Grok verdicts into persisted delegation critic scores', async () => {
    const { mapGrokResultToCriticScore } = await import('./auto-grok-critic')

    expect(mapGrokResultToCriticScore(makeGrokResult({ verdict: 'PASS' })).verdict).toBe('approved')
    expect(mapGrokResultToCriticScore(makeGrokResult({ verdict: 'NEEDS_REVISION' })).verdict).toBe('needs-revision')
    expect(mapGrokResultToCriticScore(makeGrokResult({ verdict: 'FAIL' })).verdict).toBe('rejected')
  })

  it('builds critic output from summary report details before falling back to the task goal', async () => {
    const { buildCriticAgentOutput } = await import('./auto-grok-critic')

    expect(buildCriticAgentOutput({
      keyPoints: ['Implemented auth'],
      changes: ['Added tests'],
      warnings: ['Manual secret rotation still needed'],
      timeTakenMinutes: 8,
    }, 'Fallback goal')).toContain('Warning: Manual secret rotation still needed')

    expect(buildCriticAgentOutput(undefined, 'Fallback goal')).toBe('Fallback goal')
  })

  it('runs Grok and persists criticScore without blocking on provider details', async () => {
    const delegation = makeDelegation()
    mockRunGrokCritic.mockResolvedValueOnce(makeGrokResult())
    mockRepoUpdate.mockResolvedValueOnce({ ...delegation, criticScore: {} })

    const { persistGrokCriticForDelegation } = await import('./auto-grok-critic')
    const score = await persistGrokCriticForDelegation(delegation)

    expect(score).toEqual({
      correctness: 91,
      efficiency: 84,
      drift: 97,
      verdict: 'approved',
      summary: 'The implementation meets the criteria and stays in scope.',
      runAt: '2026-05-21T10:15:00.000Z',
    })
    expect(mockRunGrokCritic).toHaveBeenCalledWith(expect.objectContaining({
      delegationTitle: 'Add auth guard',
      acceptanceCriteria: ['Routes require auth', 'Tests cover unauthorized access'],
      agentOutput: expect.stringContaining('Added route guards'),
      filesChanged: ['src/app/api/delegations/route.ts'],
    }))
    expect(mockRepoUpdate).toHaveBeenCalledWith(delegation.id, { criticScore: score })
  })

  it('returns null and skips persistence when Grok is unavailable', async () => {
    mockRunGrokCritic.mockResolvedValueOnce(null)

    const { persistGrokCriticForDelegation } = await import('./auto-grok-critic')
    const score = await persistGrokCriticForDelegation(makeDelegation())

    expect(score).toBeNull()
    expect(mockRepoUpdate).not.toHaveBeenCalled()
  })
})
