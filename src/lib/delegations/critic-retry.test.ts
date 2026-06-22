/**
 * @vitest-environment node
 *
 * Tests for G2: Critic Auto-Retry logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation, CriticScore } from '@/lib/models/delegation'
import { computeCompositeScore, triggerCriticRetry } from './critic-retry'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoCreate = vi.fn<(a: Partial<Delegation>) => Promise<Delegation>>()
const repoFindById = vi.fn<(a: string) => Promise<Delegation | null>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ create: repoCreate, findById: repoFindById })),
}))

// ── Logger mock ────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  delegationLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'Test Delegation',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    retryCount: 0,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    contract: {
      id: 'con-001',
      workItemId: 'FP-001',
      goal: 'Implement feature X',
      context: 'Initial context',
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      definitionOfDone: ['Feature works', 'Tests pass'],
      autoRetryOnCriticFail: true,
      createdAt: '2026-05-01T10:00:00.000Z',
    },
    ...overrides,
  }
}

function makeCriticScore(overrides: Partial<CriticScore> = {}): CriticScore {
  return {
    correctness: 80,
    efficiency: 80,
    drift: 80,
    verdict: 'approved',
    summary: 'Good work',
    runAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeCompositeScore', () => {
  it('calculates weighted composite: correctness×0.5 + efficiency×0.25 + drift×0.25', () => {
    const score = makeCriticScore({ correctness: 100, efficiency: 100, drift: 100 })
    expect(computeCompositeScore(score)).toBe(100)
  })

  it('weights correctness most heavily', () => {
    const score = makeCriticScore({ correctness: 80, efficiency: 60, drift: 60 })
    // 80*0.5 + 60*0.25 + 60*0.25 = 40 + 15 + 15 = 70
    expect(computeCompositeScore(score)).toBe(70)
  })

  it('returns 0 for all-zero scores', () => {
    const score = makeCriticScore({ correctness: 0, efficiency: 0, drift: 0 })
    expect(computeCompositeScore(score)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    const score = makeCriticScore({ correctness: 67, efficiency: 67, drift: 67 })
    // 67*0.5 + 67*0.25 + 67*0.25 = 33.5 + 16.75 + 16.75 = 67
    expect(computeCompositeScore(score)).toBe(67)
  })
})

describe('triggerCriticRetry', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when autoRetryOnCriticFail is false', async () => {
    const d = makeDelegation({ contract: { ...makeDelegation().contract, autoRetryOnCriticFail: false } })
    const result = await triggerCriticRetry(d, makeCriticScore({ correctness: 40, efficiency: 40, drift: 40 }))
    expect(result).toBeNull()
    expect(repoCreate).not.toHaveBeenCalled()
  })

  it('returns null when autoRetryOnCriticFail is not set', async () => {
    const d = makeDelegation({ contract: { ...makeDelegation().contract, autoRetryOnCriticFail: undefined } })
    const result = await triggerCriticRetry(d, makeCriticScore({ correctness: 40, efficiency: 40, drift: 40 }))
    expect(result).toBeNull()
  })

  it('returns null when score is at or above threshold (70)', async () => {
    const d = makeDelegation()
    // score = 70*0.5 + 70*0.25 + 70*0.25 = 70
    const result = await triggerCriticRetry(d, makeCriticScore({ correctness: 70, efficiency: 70, drift: 70 }))
    expect(result).toBeNull()
    expect(repoCreate).not.toHaveBeenCalled()
  })

  it('creates retry delegation when score < 70', async () => {
    const d = makeDelegation()
    const retryDelegation = { ...makeDelegation(), id: 'del-retry-001', retryCount: 1 }
    repoCreate.mockResolvedValueOnce(retryDelegation)

    const lowScore = makeCriticScore({ correctness: 50, efficiency: 50, drift: 50, verdict: 'needs-revision', summary: 'Needs work' })
    const result = await triggerCriticRetry(d, lowScore)

    expect(result).toBe('del-retry-001')
    expect(repoCreate).toHaveBeenCalledOnce()

    const created = repoCreate.mock.calls[0][0]
    expect(created.retryCount).toBe(1)
    expect(created.status).toBe('approved')
    expect(created.contract?.context).toContain('Previous Attempt')
    expect(created.contract?.context).toContain('Critic Review')
    expect(created.contract?.context).toContain('needs-revision')
  })

  it('returns null when retryCount has reached max (2)', async () => {
    const d = makeDelegation({ retryCount: 2 })
    const lowScore = makeCriticScore({ correctness: 40, efficiency: 40, drift: 40 })
    const result = await triggerCriticRetry(d, lowScore)
    expect(result).toBeNull()
    expect(repoCreate).not.toHaveBeenCalled()
  })

  it('increments retryCount in the new delegation', async () => {
    const d = makeDelegation({ retryCount: 1 })
    const retryDelegation = { ...makeDelegation(), id: 'del-retry-002', retryCount: 2 }
    repoCreate.mockResolvedValueOnce(retryDelegation)

    const lowScore = makeCriticScore({ correctness: 60, efficiency: 60, drift: 60, verdict: 'needs-revision' })
    await triggerCriticRetry(d, lowScore)

    const created = repoCreate.mock.calls[0][0]
    expect(created.retryCount).toBe(2)
  })

  it('sets chainedFromId to original delegation id', async () => {
    const d = makeDelegation()
    const retryDelegation = { ...makeDelegation(), id: 'del-retry-003' }
    repoCreate.mockResolvedValueOnce(retryDelegation)

    const lowScore = makeCriticScore({ correctness: 50, efficiency: 50, drift: 50, verdict: 'needs-revision' })
    await triggerCriticRetry(d, lowScore)

    const created = repoCreate.mock.calls[0][0]
    expect(created.chainedFromId).toBe('del-001')
  })

  it('includes critic score details in retry context', async () => {
    const d = makeDelegation()
    const retryDelegation = { ...makeDelegation(), id: 'del-retry-004' }
    repoCreate.mockResolvedValueOnce(retryDelegation)

    const lowScore = makeCriticScore({
      correctness: 45,
      efficiency: 55,
      drift: 50,
      verdict: 'needs-revision',
      summary: 'Tests are missing and function is too complex',
    })
    await triggerCriticRetry(d, lowScore)

    const created = repoCreate.mock.calls[0][0]
    expect(created.contract?.context).toContain('Tests are missing and function is too complex')
    expect(created.contract?.context).toContain('45')  // correctness score
    expect(created.contract?.context).toContain('55')  // efficiency score
  })
})
