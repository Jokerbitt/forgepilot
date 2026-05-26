/**
 * Tests for createDelegationFromWorkPackage and resolveDefaultExecutionRoute (via execSync mock)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkPackage } from '@/lib/models/milestone'

const mockCreate = vi.fn(async (d: unknown) => d)

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    create: mockCreate,
    listByStatus: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('child_process', () => ({
  execSync: vi.fn(() => Buffer.from('claude 1.0.0')),
}))

const baseWorkPackage: WorkPackage = {
  id: 'wp-1',
  briefId: 'brief-1',
  milestoneId: 'ms-1',
  title: 'Implement login feature',
  description: 'Build OAuth2 login flow with Google and GitHub providers',
  status: 'ready',
  riskClass: 'A',
  estimatedHours: 8,
  definitionOfDone: ['Tests pass', 'PR reviewed', 'Deployed to staging'],
  tags: ['auth', 'backend'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('createDelegationFromWorkPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockImplementation(async (d: unknown) => d)
  })

  it('creates a delegation with correct contract fields from work package', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')
    const delegation = await createDelegationFromWorkPackage(baseWorkPackage)

    expect(delegation.title).toBe(baseWorkPackage.title)
    expect(delegation.contract.goal).toBe(baseWorkPackage.description)
    expect(delegation.contract.riskClass).toBe('A')
    expect(delegation.contract.workItemId).toBe('wp-1')
    expect(delegation.briefId).toBe('brief-1')
    expect(delegation.status).toBe('pending')
  })

  it('sets requiresApproval=true only for Risk Class C', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')

    const delegationA = await createDelegationFromWorkPackage({ ...baseWorkPackage, riskClass: 'A' })
    expect(delegationA.contract.requiresApproval).toBe(false)

    const delegationB = await createDelegationFromWorkPackage({ ...baseWorkPackage, riskClass: 'B' })
    expect(delegationB.contract.requiresApproval).toBe(false)

    const delegationC = await createDelegationFromWorkPackage({ ...baseWorkPackage, riskClass: 'C' })
    expect(delegationC.contract.requiresApproval).toBe(true)
  })

  it('uses branchStrategy=fix for Risk Class C, feature otherwise', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')

    const delA = await createDelegationFromWorkPackage({ ...baseWorkPackage, riskClass: 'A' })
    expect(delA.contract.branchStrategy).toBe('feature')

    const delC = await createDelegationFromWorkPackage({ ...baseWorkPackage, riskClass: 'C' })
    expect(delC.contract.branchStrategy).toBe('fix')
  })

  it('sets taskType=bugfix when work package has "test" tag', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')

    const delWithTest = await createDelegationFromWorkPackage({ ...baseWorkPackage, tags: ['test', 'backend'] })
    expect(delWithTest.contract.taskType).toBe('bugfix')

    const delWithoutTest = await createDelegationFromWorkPackage({ ...baseWorkPackage, tags: ['backend'] })
    expect(delWithoutTest.contract.taskType).toBe('feature')
  })

  it('sets maxBudgetUsd = max(1.0, estimatedHours * 0.5)', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')

    const del8h = await createDelegationFromWorkPackage({ ...baseWorkPackage, estimatedHours: 8 })
    expect(del8h.contract.maxBudgetUsd).toBe(4.0)

    const del1h = await createDelegationFromWorkPackage({ ...baseWorkPackage, estimatedHours: 1 })
    expect(del1h.contract.maxBudgetUsd).toBe(1.0) // min 1.0

    const del0h = await createDelegationFromWorkPackage({ ...baseWorkPackage, estimatedHours: 0 })
    expect(del0h.contract.maxBudgetUsd).toBe(1.0) // min 1.0
  })

  it('uses executionRoute=local-agent when Claude CLI is available', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementation(() => Buffer.from('claude 1.0.0'))

    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')
    const delegation = await createDelegationFromWorkPackage(baseWorkPackage)
    expect(delegation.executionRoute).toBe('local-agent')
  })

  it('uses executionRoute=ollama-agent when Claude CLI is not available', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementation(() => { throw new Error('command not found: claude') })

    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')
    const delegation = await createDelegationFromWorkPackage(baseWorkPackage)
    expect(delegation.executionRoute).toBe('ollama-agent')
  })

  it('includes definitionOfDone from work package in contract', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')
    const delegation = await createDelegationFromWorkPackage(baseWorkPackage)
    expect(delegation.contract.definitionOfDone).toEqual(baseWorkPackage.definitionOfDone)
  })

  it('adds an initial log entry', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')
    const delegation = await createDelegationFromWorkPackage(baseWorkPackage)
    expect(delegation.logs).toHaveLength(1)
    expect(delegation.logs![0].type).toBe('info')
    expect(delegation.logs![0].message).toContain(baseWorkPackage.title)
  })

  it('generates unique IDs for id and contract.id', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')
    const d1 = await createDelegationFromWorkPackage(baseWorkPackage)
    const d2 = await createDelegationFromWorkPackage(baseWorkPackage)
    expect(d1.id).not.toBe(d2.id)
    expect(d1.contract.id).not.toBe(d2.contract.id)
  })

  it('calls repository.create with the constructed delegation', async () => {
    const { createDelegationFromWorkPackage } = await import('./create-from-work-package')
    await createDelegationFromWorkPackage(baseWorkPackage)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const [calledWith] = mockCreate.mock.calls[0] as [{ title: string }]
    expect(calledWith.title).toBe(baseWorkPackage.title)
  })
})
