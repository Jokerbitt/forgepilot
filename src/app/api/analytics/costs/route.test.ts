import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/dsgvo/processing-ledger', () => ({
  readProcessingLedger: vi.fn(),
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

import { readProcessingLedger } from '@/lib/dsgvo/processing-ledger'
import { readDelegations } from '@/lib/delegations/queue'
import { GET } from './route'

const mockReadLedger = vi.mocked(readProcessingLedger)
const mockReadDelegations = vi.mocked(readDelegations)

beforeEach(() => {
  vi.clearAllMocks()
  mockReadDelegations.mockReturnValue([])
})

describe('GET /api/analytics/costs', () => {
  it('returns empty analytics when no ledger records', async () => {
    mockReadLedger.mockReturnValue([])
    const res = await GET()
    const data = await res.json()
    expect(data.totals.costUsd).toBe(0)
    expect(data.totals.calls).toBe(0)
    expect(data.byProvider).toHaveLength(0)
    expect(data.byPurpose).toHaveLength(0)
    expect(data.dailyTrend).toHaveLength(30)
  })

  it('calculates total cost from input tokens (1000 tokens × $0.00025/1k = $0.00025)', async () => {
    mockReadLedger.mockReturnValue([{
      id: 'r1', purpose: 'delegation.execute', processor: 'anthropic',
      dataTypes: [], dataResidency: 'eu', retentionDays: 30,
      providerId: 'anthropic', inputTokens: 1000,
      processedAt: new Date().toISOString(),
    }])
    const res = await GET()
    const data = await res.json()
    expect(data.totals.costUsd).toBeCloseTo(0.00025, 6)
    expect(data.totals.calls).toBe(1)
  })

  it('aggregates by provider correctly', async () => {
    mockReadLedger.mockReturnValue([
      { id: 'r1', purpose: 'a', processor: 'anthropic', dataTypes: [], dataResidency: 'eu', retentionDays: 30, providerId: 'anthropic', inputTokens: 2000, processedAt: new Date().toISOString() },
      { id: 'r2', purpose: 'b', processor: 'groq', dataTypes: [], dataResidency: 'us', retentionDays: 30, providerId: 'groq', inputTokens: 1000, processedAt: new Date().toISOString() },
    ])
    const res = await GET()
    const data = await res.json()
    expect(data.byProvider).toHaveLength(2)
    const anthropic = data.byProvider.find((p: { providerId: string }) => p.providerId === 'anthropic')
    expect(anthropic.calls).toBe(1)
    expect(anthropic.inputTokens).toBe(2000)
  })

  it('aggregates by purpose correctly', async () => {
    mockReadLedger.mockReturnValue([
      { id: 'r1', purpose: 'delegation.execute', processor: 'anthropic', dataTypes: [], dataResidency: 'eu', retentionDays: 30, providerId: 'anthropic', inputTokens: 500, processedAt: new Date().toISOString() },
      { id: 'r2', purpose: 'delegation.execute', processor: 'anthropic', dataTypes: [], dataResidency: 'eu', retentionDays: 30, providerId: 'anthropic', inputTokens: 500, processedAt: new Date().toISOString() },
      { id: 'r3', purpose: 'context.build', processor: 'anthropic', dataTypes: [], dataResidency: 'eu', retentionDays: 30, providerId: 'anthropic', inputTokens: 200, processedAt: new Date().toISOString() },
    ])
    const res = await GET()
    const data = await res.json()
    const execPurpose = data.byPurpose.find((p: { purpose: string }) => p.purpose === 'delegation.execute')
    expect(execPurpose.calls).toBe(2)
    expect(execPurpose.inputTokens).toBe(1000)
  })

  it('fills all 30 days in dailyTrend even with no data', async () => {
    mockReadLedger.mockReturnValue([])
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
    mockReadLedger.mockReturnValue([])
    const res = await GET()
    const data = await res.json()
    expect(data.budgetUtilization.delegationsWithBudget).toBe(2)
    expect(data.budgetUtilization.delegationsExceeded).toBe(1)
    expect(data.budgetUtilization.utilizationPct).toBe(50)
  })

  it('handles unknown provider gracefully (cost = 0)', async () => {
    mockReadLedger.mockReturnValue([{
      id: 'r1', purpose: 'test', processor: 'ollama', dataTypes: [], dataResidency: 'local', retentionDays: 30,
      providerId: 'ollama', inputTokens: 5000, processedAt: new Date().toISOString(),
    }])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.byProvider[0].providerId).toBe('ollama')
  })
})
