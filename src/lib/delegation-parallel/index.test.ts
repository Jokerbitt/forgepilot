import { describe, it, expect, vi, beforeEach } from 'vitest'
import { spawnParallelDelegations, getParallelStatus, checkParallelCompletion } from './index'
import type { Delegation } from '@/lib/models/delegation'

const makeChild = (id: string, status: Delegation['status'], parentId?: string): Delegation => ({
  id,
  title: `Child ${id}`,
  status,
  executionRoute: 'local-agent',
  costEstimateUsd: 0,
  autoOrchestrate: false,
  contract: {
    id: 'contract-1',
    workItemId: 'test-work',
    goal: 'sub',
    context: '',
    definitionOfDone: [],
    riskClass: 'B',
    maxBudgetUsd: 0,
    allowedTools: [],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: new Date().toISOString(),
  },
  ...(parentId !== undefined ? { parentId } : {}),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const mockRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  listByStatus: vi.fn(),
  listByProject: vi.fn(),
}

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'local-user',
  createDelegationRepository: () => mockRepo,
}))

describe('spawnParallelDelegations', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates child delegations and updates parent', async () => {
    mockRepo.create.mockImplementation(async (input: { title: string }) => ({
      ...input,
      id: `child-${input.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    mockRepo.findById.mockResolvedValue({ id: 'parent-1', childIds: [] })
    mockRepo.update.mockResolvedValue({})

    const ids = await spawnParallelDelegations({
      parentId: 'parent-1',
      subTasks: [
        { title: 'frontend', goal: 'build UI' },
        { title: 'backend', goal: 'build API' },
      ],
    })

    expect(ids).toHaveLength(2)
    expect(mockRepo.create).toHaveBeenCalledTimes(2)
    expect(mockRepo.update).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({ childIds: expect.arrayContaining(['child-frontend', 'child-backend']) })
    )
  })

  it('merges with existing childIds on parent', async () => {
    mockRepo.create.mockImplementation(async (input: { title: string }) => ({
      ...input,
      id: `child-${input.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    mockRepo.findById.mockResolvedValue({ id: 'parent-1', childIds: ['existing-child'] })
    mockRepo.update.mockResolvedValue({})

    await spawnParallelDelegations({
      parentId: 'parent-1',
      subTasks: [{ title: 'new', goal: 'do new thing' }],
    })

    expect(mockRepo.update).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({
        childIds: expect.arrayContaining(['existing-child', 'child-new']),
      })
    )
  })

  it('uses provided riskClass in created contracts', async () => {
    mockRepo.create.mockImplementation(async (input: { title: string }) => ({
      ...input,
      id: `child-${input.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    mockRepo.findById.mockResolvedValue({ id: 'parent-1', childIds: [] })
    mockRepo.update.mockResolvedValue({})

    await spawnParallelDelegations({
      parentId: 'parent-1',
      subTasks: [{ title: 'task', goal: 'a task' }],
      riskClass: 'A',
    })

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contract: expect.objectContaining({ riskClass: 'A' }),
      })
    )
  })
})

describe('getParallelStatus', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when parent has no children', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'parent-1', childIds: [] })
    const result = await getParallelStatus('parent-1')
    expect(result).toBeNull()
  })

  it('returns null when parent not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await getParallelStatus('unknown')
    expect(result).toBeNull()
  })

  it('computes correct counts for mixed statuses', async () => {
    mockRepo.findById
      .mockResolvedValueOnce({ id: 'parent-1', childIds: ['c1', 'c2', 'c3', 'c4'] })
      .mockResolvedValueOnce(makeChild('c1', 'completed', 'parent-1'))
      .mockResolvedValueOnce(makeChild('c2', 'failed', 'parent-1'))
      .mockResolvedValueOnce(makeChild('c3', 'running', 'parent-1'))
      .mockResolvedValueOnce(makeChild('c4', 'pending', 'parent-1'))

    const status = await getParallelStatus('parent-1')

    expect(status).toMatchObject({
      parentId: 'parent-1',
      total: 4,
      completed: 1,
      failed: 1,
      running: 1,
      pending: 1,
      allDone: false,
      anyFailed: true,
    })
  })
})

describe('checkParallelCompletion', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('does nothing when child has no parentId', async () => {
    const child = makeChild('c1', 'completed') // no parentId
    await checkParallelCompletion(child)
    expect(mockRepo.findById).not.toHaveBeenCalled()
  })

  it('does nothing when not all children are done', async () => {
    const child = makeChild('c1', 'completed', 'parent-1')
    mockRepo.findById
      .mockResolvedValueOnce({ id: 'parent-1', childIds: ['c1', 'c2'] })
      .mockResolvedValueOnce(makeChild('c1', 'completed', 'parent-1'))
      .mockResolvedValueOnce(makeChild('c2', 'running', 'parent-1'))

    await checkParallelCompletion(child)
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it('updates parent to completed when all children succeed', async () => {
    const child = makeChild('c1', 'completed', 'parent-1')
    mockRepo.findById
      .mockResolvedValueOnce({ id: 'parent-1', childIds: ['c1', 'c2'] })
      .mockResolvedValueOnce(makeChild('c1', 'completed', 'parent-1'))
      .mockResolvedValueOnce(makeChild('c2', 'completed', 'parent-1'))
    mockRepo.update.mockResolvedValue({})

    await checkParallelCompletion(child)
    expect(mockRepo.update).toHaveBeenCalledWith('parent-1', expect.objectContaining({ status: 'completed' }))
  })

  it('updates parent to failed when at least one child fails', async () => {
    const child = makeChild('c1', 'completed', 'parent-1')
    mockRepo.findById
      .mockResolvedValueOnce({ id: 'parent-1', childIds: ['c1', 'c2'] })
      .mockResolvedValueOnce(makeChild('c1', 'completed', 'parent-1'))
      .mockResolvedValueOnce(makeChild('c2', 'failed', 'parent-1'))
    mockRepo.update.mockResolvedValue({})

    await checkParallelCompletion(child)
    expect(mockRepo.update).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({ status: 'failed', errorMessage: '1/2 sub-delegations failed' })
    )
  })

  it('never throws even if repo errors', async () => {
    const child = makeChild('c1', 'completed', 'parent-1')
    mockRepo.findById.mockRejectedValue(new Error('DB error'))

    await expect(checkParallelCompletion(child)).resolves.toBeUndefined()
  })
})
