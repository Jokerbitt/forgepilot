import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncAttentionFromDelegations } from './engine'
import * as store from './store'
import type { Delegation } from '@/lib/models/delegation'

vi.mock('./store', () => ({
  getOpenAttentionItems: vi.fn(() => []),
  upsertAttentionItem: vi.fn(),
  resolveItemsByDelegation: vi.fn(),
}))

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Test delegation',
    status: 'running',
    executionRoute: 'runner',
    costEstimateUsd: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [],
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-1',
      goal: 'Do something useful',
      context: '',
      definitionOfDone: [],
      allowedTools: [],
      riskClass: 'A',
      branchStrategy: 'feature',
      maxBudgetUsd: 5,
      taskType: 'feature',
      requiresApproval: false,
      privacyMode: 'local' as const,
      createdAt: new Date().toISOString(),
    },
    ...overrides,
  }
}

describe('syncAttentionFromDelegations', () => {
  beforeEach(() => {
    vi.mocked(store.getOpenAttentionItems).mockReturnValue([])
    vi.mocked(store.upsertAttentionItem).mockClear()
    vi.mocked(store.resolveItemsByDelegation).mockClear()
  })

  it('creates an attention item for failed delegation', () => {
    const d = makeDelegation({ status: 'failed' })
    syncAttentionFromDelegations([d])
    expect(store.upsertAttentionItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'delegation_failed', severity: 'critical', delegationId: 'del-1' })
    )
  })

  it('creates approval_pending item for approved delegation', () => {
    const d = makeDelegation({ status: 'approved' })
    syncAttentionFromDelegations([d])
    expect(store.upsertAttentionItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'approval_pending', severity: 'info' })
    )
  })

  it('creates budget_exceeded item when cost >90% of budget', () => {
    const d = makeDelegation({ actualCostUsd: 4.6, contract: { id: 'c1', workItemId: 'JOK-1', goal: 'g', context: '', definitionOfDone: [], allowedTools: [], riskClass: 'A', branchStrategy: 'feature', maxBudgetUsd: 5, taskType: 'feature', requiresApproval: false, privacyMode: 'local' as const, createdAt: new Date().toISOString() } })
    syncAttentionFromDelegations([d])
    expect(store.upsertAttentionItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'budget_exceeded', severity: 'critical' })
    )
  })

  it('does not duplicate existing items', () => {
    vi.mocked(store.getOpenAttentionItems).mockReturnValue([
      { id: 'delegation_failed:del-1', type: 'delegation_failed', severity: 'critical', title: 'x', body: 'x', createdAt: new Date().toISOString() }
    ])
    const d = makeDelegation({ status: 'failed' })
    syncAttentionFromDelegations([d])
    expect(store.upsertAttentionItem).not.toHaveBeenCalled()
  })

  it('resolves items for completed delegations', () => {
    const d = makeDelegation({ status: 'completed' })
    syncAttentionFromDelegations([d])
    expect(store.resolveItemsByDelegation).toHaveBeenCalledWith('del-1', 'system')
  })
})
