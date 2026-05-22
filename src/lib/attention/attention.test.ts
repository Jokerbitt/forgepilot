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

  it('creates sla_warning item when SLA has ≤25% time left', () => {
    // Risk class C = 8h SLA. Create delegation that started 6h 15m ago → 1h 45m left = ~21.8% → warning
    const createdAt = new Date(Date.now() - (6 * 60 + 15) * 60 * 1000).toISOString()
    const d = makeDelegation({
      status: 'pending',
      createdAt,
      contract: {
        id: 'c2', workItemId: 'JOK-2', goal: 'g', context: '', definitionOfDone: [],
        allowedTools: [], riskClass: 'C', branchStrategy: 'feature',
        maxBudgetUsd: 5, taskType: 'feature', requiresApproval: false,
        privacyMode: 'local' as const, createdAt,
      },
    })
    syncAttentionFromDelegations([d])
    expect(store.upsertAttentionItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sla_warning', severity: 'warning', delegationId: 'del-1' })
    )
  })

  it('creates sla_breached item when SLA is past due', () => {
    // Risk class C = 8h. Delegation created 10h ago → breached
    const createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
    const d = makeDelegation({
      status: 'running',
      createdAt,
      updatedAt: new Date().toISOString(),
      contract: {
        id: 'c3', workItemId: 'JOK-3', goal: 'g', context: '', definitionOfDone: [],
        allowedTools: [], riskClass: 'C', branchStrategy: 'feature',
        maxBudgetUsd: 5, taskType: 'feature', requiresApproval: false,
        privacyMode: 'local' as const, createdAt,
      },
    })
    syncAttentionFromDelegations([d])
    expect(store.upsertAttentionItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sla_breached', severity: 'critical', delegationId: 'del-1' })
    )
  })

  it('does not create SLA item for completed delegations', () => {
    const createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
    const d = makeDelegation({
      status: 'completed',
      createdAt,
      contract: {
        id: 'c4', workItemId: 'JOK-4', goal: 'g', context: '', definitionOfDone: [],
        allowedTools: [], riskClass: 'C', branchStrategy: 'feature',
        maxBudgetUsd: 5, taskType: 'feature', requiresApproval: false,
        privacyMode: 'local' as const, createdAt,
      },
    })
    syncAttentionFromDelegations([d])
    const calls = vi.mocked(store.upsertAttentionItem).mock.calls
    const slaTypes = calls.flatMap(([item]) => [item.type]).filter(t => t.startsWith('sla'))
    expect(slaTypes).toHaveLength(0)
  })

  it('does not duplicate sla_breached if already in attention store', () => {
    const createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
    vi.mocked(store.getOpenAttentionItems).mockReturnValue([
      { id: 'sla_breached:del-1', type: 'sla_breached', severity: 'critical', title: 'x', body: 'x', createdAt: new Date().toISOString() }
    ])
    const d = makeDelegation({
      status: 'running',
      createdAt,
      updatedAt: new Date().toISOString(),
      contract: {
        id: 'c5', workItemId: 'JOK-5', goal: 'g', context: '', definitionOfDone: [],
        allowedTools: [], riskClass: 'C', branchStrategy: 'feature',
        maxBudgetUsd: 5, taskType: 'feature', requiresApproval: false,
        privacyMode: 'local' as const, createdAt,
      },
    })
    syncAttentionFromDelegations([d])
    expect(store.upsertAttentionItem).not.toHaveBeenCalled()
  })
})
