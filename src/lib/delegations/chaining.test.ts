/**
 * M230: Tests for delegation chaining
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFindById = vi.fn()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'single-tenant',
  createDelegationRepository: () => ({
    create: mockCreate,
    update: mockUpdate,
    findById: mockFindById,
    delete: vi.fn(),
    listByStatus: vi.fn(),
    listByProject: vi.fn(),
  }),
}))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Test Delegation',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    contract: {
      id: 'contract-1',
      workItemId: 'WORK-1',
      goal: 'Do something',
      context: '',
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: new Date().toISOString(),
      definitionOfDone: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('triggerChain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  it('returns skipped=true when no chainConfig', async () => {
    const { triggerChain } = await import('./chaining')
    const delegation = makeDelegation()
    const result = await triggerChain(delegation, 'some output')
    expect(result.skipped).toBe(true)
    expect(result.created).toBe(false)
    expect(result.reason).toBe('no chainConfig')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns created=false, skipped=true on repository error (fail-open)', async () => {
    const { triggerChain } = await import('./chaining')
    mockCreate.mockRejectedValueOnce(new Error('DB down'))

    const delegation = makeDelegation({
      chainConfig: {
        nextTitle: 'Follow-up',
        nextPrompt: 'Do the next thing',
        autoStart: false,
        passOutputAs: 'none',
      },
    })

    const result = await triggerChain(delegation, 'output')
    expect(result.created).toBe(false)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('error during chain trigger')
  })

  it('creates a chained delegation and returns created=true with delegationId', async () => {
    const { triggerChain } = await import('./chaining')

    const createdDelegation = makeDelegation({ id: 'del-2', title: 'Follow-up' })
    mockCreate.mockResolvedValueOnce(createdDelegation)
    mockUpdate.mockResolvedValueOnce(makeDelegation({ chainedDelegationId: 'del-2' }))

    const delegation = makeDelegation({
      chainConfig: {
        nextTitle: 'Follow-up',
        nextPrompt: 'Do the next thing',
        autoStart: false,
        passOutputAs: 'none',
      },
    })

    const result = await triggerChain(delegation, 'output')

    expect(result.created).toBe(true)
    expect(result.delegationId).toBe('del-2')
    expect(result.skipped).toBe(false)
    expect(mockCreate).toHaveBeenCalledOnce()

    // Verify the created delegation has chainedFromId set
    const createArg = mockCreate.mock.calls[0][0] as Partial<Delegation>
    expect(createArg.chainedFromId).toBe('del-1')
    expect(createArg.title).toBe('Follow-up')
  })

  it('prepends last 500 chars of output to nextPrompt when passOutputAs=context', async () => {
    const { triggerChain } = await import('./chaining')

    const createdDelegation = makeDelegation({ id: 'del-3', title: 'With context' })
    mockCreate.mockResolvedValueOnce(createdDelegation)
    mockUpdate.mockResolvedValueOnce(makeDelegation({ chainedDelegationId: 'del-3' }))

    const longOutput = 'x'.repeat(600)
    const expectedSnippet = longOutput.slice(-500)

    const delegation = makeDelegation({
      chainConfig: {
        nextTitle: 'With context',
        nextPrompt: 'Continue from here',
        autoStart: false,
        passOutputAs: 'context',
      },
    })

    await triggerChain(delegation, longOutput)

    const createArg = mockCreate.mock.calls[0][0] as Partial<Delegation>
    const goal = createArg.contract?.goal ?? ''
    expect(goal).toContain('Continue from here')
    expect(goal).toContain(expectedSnippet)
  })

  it('calls approve + execute endpoints when autoStart=true', async () => {
    const { triggerChain } = await import('./chaining')

    const createdDelegation = makeDelegation({ id: 'del-4', title: 'Auto-started' })
    mockCreate.mockResolvedValueOnce(createdDelegation)
    mockUpdate.mockResolvedValueOnce(makeDelegation({ chainedDelegationId: 'del-4' }))

    const delegation = makeDelegation({
      chainConfig: {
        nextTitle: 'Auto-started',
        nextPrompt: 'Do it now',
        autoStart: true,
        passOutputAs: 'none',
      },
    })

    await triggerChain(delegation, 'output')

    const fetchCalls = mockFetch.mock.calls as Array<[string, RequestInit]>
    const approveCall = fetchCalls.find(([url]) => url.includes('/approve'))
    const executeCall = fetchCalls.find(([url]) => url.includes('/execute'))

    expect(approveCall).toBeDefined()
    expect(executeCall).toBeDefined()
    expect(approveCall![0]).toContain('del-4')
    expect(executeCall![0]).toContain('del-4')
  })

  it('does not call approve/execute when autoStart=false', async () => {
    const { triggerChain } = await import('./chaining')

    const createdDelegation = makeDelegation({ id: 'del-5', title: 'Pending' })
    mockCreate.mockResolvedValueOnce(createdDelegation)
    mockUpdate.mockResolvedValueOnce(makeDelegation({ chainedDelegationId: 'del-5' }))

    const delegation = makeDelegation({
      chainConfig: {
        nextTitle: 'Pending',
        nextPrompt: 'Wait for approval',
        autoStart: false,
        passOutputAs: 'none',
      },
    })

    await triggerChain(delegation, 'output')

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
