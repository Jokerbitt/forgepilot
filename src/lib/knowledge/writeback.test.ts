import { describe, it, expect, vi } from 'vitest'
import { writebackExecutionInsights } from './writeback'
import type { Delegation } from '@/lib/models/delegation'
import type { KnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'

const mockUpsert = vi.fn().mockResolvedValue({})

vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: vi.fn(() => ({
    upsert: mockUpsert,
    create: vi.fn(),
    findById: vi.fn(),
    listAll: vi.fn(),
    listByDelegation: vi.fn(),
    listByType: vi.fn(),
  }) as KnowledgeCardRepository),
}))

const mockDelegation = (overrides: Partial<Delegation> = {}): Delegation => ({
  id: 'del-1',
  title: 'Test Delegation',
  status: 'completed',
  executionRoute: 'local-agent',
  costEstimateUsd: 0,
  autoOrchestrate: false,
  contract: {
    id: 'contract-1',
    workItemId: 'TEST-1',
    goal: 'test goal',
    context: '',
    definitionOfDone: [],
    riskClass: 'B',
    maxBudgetUsd: 1,
    allowedTools: [],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  criticScore: {
    correctness: 80,
    efficiency: 75,
    drift: 20,
    verdict: 'approved',
    summary: 'Good execution',
    runAt: new Date().toISOString(),
  },
  ...overrides,
})

describe('writebackExecutionInsights', () => {
  it('saves insights for completed approved delegations', async () => {
    const result = await writebackExecutionInsights(mockDelegation())
    expect(result.skipped).toBe(false)
    expect(result.saved).toBeGreaterThan(0)
  })

  it('saves more insights when summaryReport is present', async () => {
    const result = await writebackExecutionInsights(
      mockDelegation({
        summaryReport: {
          keyPoints: ['point1'],
          changes: [],
          timeTakenMinutes: 5,
        },
      }),
    )
    expect(result.skipped).toBe(false)
    expect(result.saved).toBeGreaterThanOrEqual(2)
  })

  it('skips rejected delegations', async () => {
    const result = await writebackExecutionInsights(
      mockDelegation({
        criticScore: {
          correctness: 20,
          efficiency: 20,
          drift: 80,
          verdict: 'rejected',
          summary: 'bad',
          runAt: '',
        },
      }),
    )
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('critic rejected execution')
  })

  it('skips delegations without critic score', async () => {
    const result = await writebackExecutionInsights(mockDelegation({ criticScore: undefined }))
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('no critic score or not completed')
  })

  it('skips non-completed delegations', async () => {
    const result = await writebackExecutionInsights(mockDelegation({ status: 'failed' }))
    expect(result.skipped).toBe(true)
  })

  it('returns skipped on repository error', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('db error'))
    const result = await writebackExecutionInsights(mockDelegation())
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('error during writeback')
  })
})
