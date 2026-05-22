import { describe, it, expect } from 'vitest'
import { buildClonedDelegation } from './clone'
import type { Delegation } from '@/lib/models/delegation'

function makeSource(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'src-1',
    title: 'Add pagination',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    contract: {
      id: 'tc-1',
      workItemId: 'WI-1',
      goal: 'Add pagination endpoint',
      context: 'Uses cursor-based pagination',
      definitionOfDone: ['Tests pass', 'PR created'],
      riskClass: 'A',
      maxBudgetUsd: 2,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildClonedDelegation', () => {
  it('sets status to pending', () => {
    const clone = buildClonedDelegation(makeSource())
    expect(clone.status).toBe('pending')
  })

  it('appends (Kopie) to the title', () => {
    const clone = buildClonedDelegation(makeSource({ title: 'My task' }))
    expect(clone.title).toBe('My task (Kopie)')
  })

  it('preserves goal, DoD and riskClass from contract', () => {
    const source = makeSource()
    const clone = buildClonedDelegation(source)
    expect(clone.contract.goal).toBe(source.contract.goal)
    expect(clone.contract.definitionOfDone).toEqual(source.contract.definitionOfDone)
    expect(clone.contract.riskClass).toBe(source.contract.riskClass)
  })

  it('generates a new contract id', () => {
    const source = makeSource()
    const clone = buildClonedDelegation(source)
    expect(clone.contract.id).not.toBe(source.contract.id)
    expect(clone.contract.id).toBeTruthy()
  })

  it('clears execution-specific fields (logs, errorMessage, actualCostUsd)', () => {
    const source = makeSource()
    const clone = buildClonedDelegation(source)
    expect((clone as Partial<Delegation>).logs).toBeUndefined()
    expect((clone as Partial<Delegation>).errorMessage).toBeUndefined()
    expect((clone as Partial<Delegation>).actualCostUsd).toBeUndefined()
  })

  it('preserves executionRoute and costEstimateUsd', () => {
    const source = makeSource({ executionRoute: 'local-agent', costEstimateUsd: 1.23 })
    const clone = buildClonedDelegation(source)
    expect(clone.executionRoute).toBe('local-agent')
    expect(clone.costEstimateUsd).toBe(1.23)
  })

  it('preserves briefId and priority', () => {
    const source = makeSource({ briefId: 'brief-42', priority: 3 })
    const clone = buildClonedDelegation(source)
    expect(clone.briefId).toBe('brief-42')
    expect(clone.priority).toBe(3)
  })
})
