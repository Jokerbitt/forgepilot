import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'test-user',
  createDelegationRepository: vi.fn(),
}))

import { POST } from './route'
import { createDelegationRepository } from '@/lib/repositories/delegationRepository'

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFindById = vi.fn()

vi.mocked(createDelegationRepository).mockReturnValue({
  findById: mockFindById,
  create: mockCreate,
  update: mockUpdate,
} as unknown as ReturnType<typeof createDelegationRepository>)

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const baseDelegation = {
  id: 'del-1',
  title: 'Implement auth',
  status: 'completed' as const,
  executionRoute: 'local-agent' as const,
  costEstimateUsd: 2,
  logs: [],
  tags: ['plan:p1'],
  contract: {
    id: 'c1',
    workItemId: 'w1',
    goal: 'Implement auth',
    context: 'Use JWT',
    riskClass: 'B' as const,
    maxBudgetUsd: 2,
    allowedTools: ['Read', 'Write'],
    branchStrategy: 'feature' as const,
    requiresApproval: false,
    privacyMode: 'local' as const,
    definitionOfDone: ['Tests pass', 'TypeScript clean'],
    createdAt: '2024-01-01T00:00:00Z',
    taskType: 'feature' as const,
  },
  qualityCheck: {
    criteria: [
      { item: 'Tests pass', met: false, confidence: 'high' as const, notes: 'No tests found' },
      { item: 'TypeScript clean', met: true, confidence: 'high' as const, notes: '' },
    ],
    overallScore: 40,
    verdict: 'failed' as const,
    suggestion: 'Add unit tests for the auth handler',
    checkedAt: '2024-01-01T01:00:00Z',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('POST /api/delegations/[id]/review-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ ...baseDelegation, id: 'new-del-1' })
    mockUpdate.mockResolvedValue(baseDelegation)
  })

  it('returns 404 when delegation not found', async () => {
    mockFindById.mockResolvedValue(null)
    const res = await POST(new Request('http://localhost'), makeParams('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 409 when delegation is not completed', async () => {
    mockFindById.mockResolvedValue({ ...baseDelegation, status: 'failed' })
    const res = await POST(new Request('http://localhost'), makeParams('del-1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('abgeschlossene')
  })

  it('returns 409 when quality check verdict is passed', async () => {
    mockFindById.mockResolvedValue({
      ...baseDelegation,
      qualityCheck: { ...baseDelegation.qualityCheck, verdict: 'passed' },
    })
    const res = await POST(new Request('http://localhost'), makeParams('del-1'))
    expect(res.status).toBe(409)
  })

  it('returns 409 when no quality check exists', async () => {
    mockFindById.mockResolvedValue({ ...baseDelegation, qualityCheck: undefined })
    const res = await POST(new Request('http://localhost'), makeParams('del-1'))
    expect(res.status).toBe(409)
  })

  it('creates a new delegation with review feedback in context', async () => {
    mockFindById.mockResolvedValue(baseDelegation)
    const res = await POST(new Request('http://localhost'), makeParams('del-1'))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledOnce()
    const created = mockCreate.mock.calls[0][0] as { contract: { context: string }; title: string }
    expect(created.contract.context).toContain('Review Feedback')
    expect(created.contract.context).toContain('No tests found')
    expect(created.contract.context).toContain('Add unit tests')
    expect(created.title).toContain('[Fix]')
  })

  it('returns the new delegation id', async () => {
    mockFindById.mockResolvedValue(baseDelegation)
    const res = await POST(new Request('http://localhost'), makeParams('del-1'))
    const body = await res.json()
    expect(body.delegationId).toBe('new-del-1')
  })

  it('adds review-retry-of tag to the new delegation', async () => {
    mockFindById.mockResolvedValue(baseDelegation)
    await POST(new Request('http://localhost'), makeParams('del-1'))
    const created = mockCreate.mock.calls[0][0] as { tags: string[] }
    expect(created.tags).toContain('review-retry-of:del-1')
  })

  it('logs the retry on the original delegation', async () => {
    mockFindById.mockResolvedValue(baseDelegation)
    await POST(new Request('http://localhost'), makeParams('del-1'))
    expect(mockUpdate).toHaveBeenCalledWith('del-1', expect.objectContaining({
      logs: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('Review-Retry') }),
      ]),
    }))
  })

  it('sets chainedFromId on new delegation', async () => {
    mockFindById.mockResolvedValue(baseDelegation)
    await POST(new Request('http://localhost'), makeParams('del-1'))
    const created = mockCreate.mock.calls[0][0] as { chainedFromId: string }
    expect(created.chainedFromId).toBe('del-1')
  })
})
