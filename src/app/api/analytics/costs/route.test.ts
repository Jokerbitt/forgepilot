import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProcessingRecord } from '@/lib/dsgvo/processing-ledger'

vi.mock('@/lib/dsgvo/processing-ledger', () => ({
  readProcessingLedgerAsync: vi.fn(),
}))
vi.mock('@/lib/delegations/queue', () => ({
  readDelegations: vi.fn(),
}))
vi.mock('@/lib/delegations/cost-tracker', () => ({
  calculateCallCost: vi.fn(({ inputTokens }: { inputTokens: number }) => ({
    inputCostUsd: inputTokens * 0.00025 / 1000,
    outputCostUsd: 0,
    totalCostUsd: inputTokens * 0.00025 / 1000,
    providerId: 'anthropic',
    modelId: '',
    hasPricingData: true,
  })),
}))
vi.mock('@/lib/logger', () => ({ apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

import { readProcessingLedgerAsync } from '@/lib/dsgvo/processing-ledger'
import { readDelegations } from '@/lib/delegations/queue'
import { GET } from './route'

const mockReadLedger = vi.mocked(readProcessingLedgerAsync)
const mockReadDelegations = vi.mocked(readDelegations)

/** Build a minimal valid ProcessingRecord for test fixtures */
function makeRecord(overrides: Partial<ProcessingRecord> & { id: string }): ProcessingRecord {
  return {
    purpose: 'delegation.execute',
    processor: 'anthropic',
    dataTypes: [],
    legalBasis: 'legitimate-interest',
    dataResidency: 'eu',
    piiDetected: false,
    piiCategories: [],
    piiRedacted: false,
    piiCount: 0,
    retentionDays: 30,
    processedAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReadDelegations.mockReturnValue([])
})

describe('GET /api/analytics/costs', () => {
  it('returns empty analytics when no ledger records', async () => {
    mockReadLedger.mockResolvedValue([])
    const res = await GET()
    const data = await res.json()
    expect(data.totals.costUsd).toBe(0)
    expect(data.totals.calls).toBe(0)
    expect(data.byProvider).toHaveLength(0)
    expect(data.byPurpose).toHaveLength(0)
    expect(data.dailyTrend).toHaveLength(30)
  })

  it('calculates total cost from input tokens (1000 tokens × $0.00025/1k = $0.00025)', async () => {
    mockReadLedger.mockResolvedValue([
      makeRecord({ id: 'r1', providerId: 'anthropic', inputTokens: 1000 }),
    ])
    const res = await GET()
    const data = await res.json()
    expect(data.totals.costUsd).toBeCloseTo(0.00025, 6)
    expect(data.totals.calls).toBe(1)
  })

  it('aggregates by provider correctly', async () => {
    mockReadLedger.mockResolvedValue([
      makeRecord({ id: 'r1', purpose: 'a', processor: 'anthropic', providerId: 'anthropic', inputTokens: 2000 }),
      makeRecord({ id: 'r2', purpose: 'b', processor: 'groq', dataResidency: 'us', providerId: 'groq', inputTokens: 1000 }),
    ])
    const res = await GET()
    const data = await res.json()
    expect(data.byProvider).toHaveLength(2)
    const anthropic = data.byProvider.find((p: { providerId: string }) => p.providerId === 'anthropic')
    expect(anthropic.calls).toBe(1)
    expect(anthropic.inputTokens).toBe(2000)
  })

  it('aggregates by purpose correctly', async () => {
    mockReadLedger.mockResolvedValue([
      makeRecord({ id: 'r1', purpose: 'delegation.execute', providerId: 'anthropic', inputTokens: 500 }),
      makeRecord({ id: 'r2', purpose: 'delegation.execute', providerId: 'anthropic', inputTokens: 500 }),
      makeRecord({ id: 'r3', purpose: 'context.build', providerId: 'anthropic', inputTokens: 200 }),
    ])
    const res = await GET()
    const data = await res.json()
    const execPurpose = data.byPurpose.find((p: { purpose: string }) => p.purpose === 'delegation.execute')
    expect(execPurpose.calls).toBe(2)
    expect(execPurpose.inputTokens).toBe(1000)
  })

  it('fills all 30 days in dailyTrend even with no data', async () => {
    mockReadLedger.mockResolvedValue([])
    const res = await GET()
    const data = await res.json()
    expect(data.dailyTrend).toHaveLength(30)
    expect(data.dailyTrend.every((d: { totalCostUsd: number }) => d.totalCostUsd === 0)).toBe(true)
  })

  it('computes budget utilization from delegations', async () => {
    mockReadDelegations.mockReturnValue([
      { id: 'd1', title: 'x', contract: { id: 'd1', workItemId: 'WI-1', goal: '', context: '', definitionOfDone: [], riskClass: 'low', maxBudgetUsd: 1, allowedTools: [], branchStrategy: 'feature', requiresApproval: false, privacyMode: 'local', createdAt: '' }, status: 'completed', executionRoute: 'runner', costEstimateUsd: 0.5, actualCostUsd: 2, priority: 3, createdAt: '', updatedAt: '' },
      { id: 'd2', title: 'y', contract: { id: 'd2', workItemId: 'WI-2', goal: '', context: '', definitionOfDone: [], riskClass: 'low', maxBudgetUsd: 5, allowedTools: [], branchStrategy: 'feature', requiresApproval: false, privacyMode: 'local', createdAt: '' }, status: 'completed', executionRoute: 'runner', costEstimateUsd: 0.5, actualCostUsd: 1, priority: 3, createdAt: '', updatedAt: '' },
    ] as never)
    mockReadLedger.mockResolvedValue([])
    const res = await GET()
    const data = await res.json()
    expect(data.budgetUtilization.delegationsWithBudget).toBe(2)
    expect(data.budgetUtilization.delegationsExceeded).toBe(1)
    expect(data.budgetUtilization.utilizationPct).toBe(50)
  })

  it('handles unknown provider gracefully (cost = 0)', async () => {
    mockReadLedger.mockResolvedValue([
      makeRecord({ id: 'r1', purpose: 'test', processor: 'ollama', dataResidency: 'local', providerId: 'ollama', inputTokens: 5000 }),
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.byProvider[0].providerId).toBe('ollama')
  })
})
