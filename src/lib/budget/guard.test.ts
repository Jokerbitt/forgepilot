import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkBudget, getBudgetLimit, wouldExceedBudget, effectiveBudgetLimit } from './guard'
import type { Delegation } from '@/lib/models/delegation'

const mockRepo = { update: vi.fn(), findById: vi.fn(), create: vi.fn(), delete: vi.fn(), listByStatus: vi.fn(), listByProject: vi.fn() }

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'local-user',
  createDelegationRepository: () => mockRepo,
}))
vi.mock('@/lib/notifications', () => ({
  notifyExecutionResult: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/nba-engine/nba-config', () => ({ getNBAConfig: vi.fn() }))
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
const mockCfg = vi.mocked(getNBAConfig)
function cfg(enforcement: 'strict' | 'tolerant' | 'off', pct = 20) {
  mockCfg.mockReturnValue({ budgetEnforcement: enforcement, budgetTolerancePct: pct } as never)
}

const base: Delegation = {
  id: 'del-1',
  title: 'Test',
  status: 'running',
  executionRoute: 'local-agent',
  costEstimateUsd: 0.5,
  actualCostUsd: 0.5,
  autoOrchestrate: false,
  contract: { riskClass: 'B', goal: 'test', acceptanceCriteria: [], maxCostUsd: 1.0 } as never,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('checkBudget', () => {
  beforeEach(() => { vi.clearAllMocks(); cfg('strict') })

  it('returns not exceeded when under limit', async () => {
    const result = await checkBudget(base)
    expect(result.exceeded).toBe(false)
  })

  it('returns exceeded and fails delegation when over limit', async () => {
    mockRepo.update.mockResolvedValue({})
    const result = await checkBudget({ ...base, actualCostUsd: 2.0 })
    expect(result.exceeded).toBe(true)
    expect(mockRepo.update).toHaveBeenCalledWith('del-1', expect.objectContaining({ status: 'failed' }))
  })

  it('returns not exceeded when no limit configured', async () => {
    const result = await checkBudget({ ...base, contract: { riskClass: 'B', goal: 'test', acceptanceCriteria: [] } as never })
    expect(result.exceeded).toBe(false)
  })
})

describe('getBudgetLimit', () => {
  it('prefers explicit maxCostUsd when present', () => {
    expect(getBudgetLimit({
      ...base,
      contract: { ...base.contract, maxCostUsd: 0.75, maxBudgetUsd: 2 } as never,
    })).toBe(0.75)
  })

  it('falls back to maxBudgetUsd for ordinary delegations', () => {
    expect(getBudgetLimit({
      ...base,
      contract: { riskClass: 'B', goal: 'test', acceptanceCriteria: [], maxBudgetUsd: 1 } as never,
    })).toBe(1)
  })

  it('returns null when neither budget field is positive', () => {
    expect(getBudgetLimit({
      ...base,
      contract: { riskClass: 'B', goal: 'test', acceptanceCriteria: [], maxBudgetUsd: 0 } as never,
    })).toBeNull()
  })
})

describe('wouldExceedBudget', () => {
  it('returns false when no limit', () => {
    expect(wouldExceedBudget({ ...base, contract: { riskClass: 'B', goal: '', acceptanceCriteria: [] } as never }, 999)).toBe(false)
  })

  it('returns true when estimate exceeds limit', () => {
    expect(wouldExceedBudget(base, 2.0)).toBe(true)
  })

  it('returns false when estimate is within limit', () => {
    expect(wouldExceedBudget(base, 0.5)).toBe(false)
  })

  it('uses maxBudgetUsd when maxCostUsd is not set', () => {
    const delegation = {
      ...base,
      contract: { riskClass: 'B', goal: 'test', acceptanceCriteria: [], maxBudgetUsd: 1 } as never,
    }

    expect(wouldExceedBudget(delegation, 1.25)).toBe(true)
  })
})


describe('effectiveBudgetLimit (settings-driven)', () => {
  beforeEach(() => mockCfg.mockReset())
  it('off → no cap', () => { cfg('off'); expect(effectiveBudgetLimit(4)).toBeNull() })
  it('strict → exact', () => { cfg('strict'); expect(effectiveBudgetLimit(4)).toBe(4) })
  it('tolerant 20% → +20%', () => { cfg('tolerant', 20); expect(effectiveBudgetLimit(4)).toBeCloseTo(4.8) })
  it('tolerant 50% → +50%', () => { cfg('tolerant', 50); expect(effectiveBudgetLimit(10)).toBeCloseTo(15) })
  it('null limit stays null', () => { cfg('strict'); expect(effectiveBudgetLimit(null)).toBeNull() })
})
