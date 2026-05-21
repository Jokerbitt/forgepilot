import { describe, it, expect, vi, beforeEach } from 'vitest'
import { triggerChainedDelegation } from './index'
import type { Delegation } from '@/lib/models/delegation'

const mockRepo = {
  findById: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  listByStatus: vi.fn(),
  listByProject: vi.fn(),
}

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'local-user',
  createDelegationRepository: () => mockRepo,
}))

const base: Delegation = {
  id: 'del-1',
  title: 'Step 1',
  status: 'completed',
  executionRoute: 'local-agent',
  costEstimateUsd: 0,
  autoOrchestrate: false,
  contract: { riskClass: 'B', goal: 'step 1', acceptanceCriteria: [] } as never,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  chainNextId: 'del-2',
}

describe('triggerChainedDelegation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('does nothing when no chainNextId', async () => {
    await triggerChainedDelegation({ ...base, chainNextId: undefined })
    expect(mockRepo.findById).not.toHaveBeenCalled()
  })

  it('does nothing when delegation not completed', async () => {
    await triggerChainedDelegation({ ...base, status: 'failed' })
    expect(mockRepo.findById).not.toHaveBeenCalled()
  })

  it('approves next delegation when autoChain is true', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'del-2', status: 'pending' })
    mockRepo.update.mockResolvedValue({})
    await triggerChainedDelegation({ ...base, contract: { ...base.contract, autoChain: true } as never })
    expect(mockRepo.update).toHaveBeenCalledWith('del-2', { status: 'approved' })
  })

  it('does not auto-approve when autoChain is false', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'del-2', status: 'pending' })
    await triggerChainedDelegation(base)
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it('does nothing when next delegation is not in pending status', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'del-2', status: 'running' })
    await triggerChainedDelegation({ ...base, contract: { ...base.contract, autoChain: true } as never })
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it('does nothing when next delegation does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await triggerChainedDelegation({ ...base, contract: { ...base.contract, autoChain: true } as never })
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it('never throws even when repo throws', async () => {
    mockRepo.findById.mockRejectedValue(new Error('DB connection failed'))
    await expect(triggerChainedDelegation(base)).resolves.toBeUndefined()
  })
})
