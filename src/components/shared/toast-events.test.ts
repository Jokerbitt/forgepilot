import { describe, expect, it } from 'vitest'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'
import {
  buildDelegationCompletionToasts,
  truncateToastMessage,
  type DelegationStatusSnapshot,
} from '@/components/shared/toast-events'

function createDelegation(id: string, status: DelegationStatus, goal = 'Implement the next useful feature'): Delegation {
  return {
    id,
    status,
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    contract: {
      id: `contract-${id}`,
      workItemId: `LOCAL-${id}`,
      goal,
      context: 'Toast test fixture',
      definitionOfDone: ['Toast state is derived correctly'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: ['read_file'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-16T08:00:00.000Z',
    },
    createdAt: '2026-05-16T08:00:00.000Z',
    updatedAt: '2026-05-16T08:00:00.000Z',
  }
}

describe('truncateToastMessage', () => {
  it('keeps short messages unchanged', () => {
    expect(truncateToastMessage('Short task', 20)).toBe('Short task')
  })

  it('truncates long messages with an ASCII ellipsis', () => {
    expect(truncateToastMessage('1234567890', 6)).toBe('123...')
  })
})

describe('buildDelegationCompletionToasts', () => {
  it('creates a success toast when a delegation moves from running to completed', () => {
    const previousStatuses: DelegationStatusSnapshot = { 'del-1': 'running' }
    const result = buildDelegationCompletionToasts([
      createDelegation('del-1', 'completed', 'Build the completion toast flow'),
    ], previousStatuses)

    expect(result.toasts).toEqual([
      {
        type: 'success',
        title: 'Agent fertig',
        message: 'Build the completion toast flow',
        delegationId: 'del-1',
      },
    ])
    expect(result.nextStatuses).toEqual({ 'del-1': 'completed' })
  })

  it('creates an error toast when a delegation moves from running to failed', () => {
    const previousStatuses: DelegationStatusSnapshot = { 'del-1': 'running' }
    const result = buildDelegationCompletionToasts([
      createDelegation('del-1', 'failed', 'Fix a failing automation'),
    ], previousStatuses)

    expect(result.toasts[0]).toMatchObject({
      type: 'error',
      title: 'Agent fehlgeschlagen',
      delegationId: 'del-1',
    })
  })

  it('does not create a toast on initial load or unrelated state changes', () => {
    const result = buildDelegationCompletionToasts([
      createDelegation('del-1', 'completed'),
      createDelegation('del-2', 'approved'),
    ], { 'del-2': 'pending' })

    expect(result.toasts).toHaveLength(0)
    expect(result.nextStatuses).toEqual({
      'del-1': 'completed',
      'del-2': 'approved',
    })
  })

  it('drops removed delegations from the next status snapshot', () => {
    const result = buildDelegationCompletionToasts([
      createDelegation('del-2', 'running'),
    ], { 'del-1': 'running', 'del-2': 'running' })

    expect(result.nextStatuses).toEqual({ 'del-2': 'running' })
  })
})
