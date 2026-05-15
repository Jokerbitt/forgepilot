import { describe, it, expect } from 'vitest'
import type { TaskContract, Delegation, DelegationStatus, ExecutionRoute } from './delegation'

describe('TaskContract type', () => {
  it('accepts a valid TaskContract', () => {
    const contract: TaskContract = {
      id: 'tc-1',
      workItemId: 'lin-1',
      goal: 'Fix the login bug by correcting the JWT validation logic',
      context: 'Bug reported in JOK-1. Token expires too early.',
      definitionOfDone: ['Tests pass', 'PR merged', 'No lint errors'],
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read', 'edit', 'bash'],
      branchStrategy: 'fix',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-15T10:00:00Z',
    }
    expect(contract.riskClass).toBe('A')
    expect(contract.requiresApproval).toBe(false)
    expect(contract.definitionOfDone).toHaveLength(3)
  })

  it('RiskClass C requires approval', () => {
    const contract: TaskContract = {
      id: 'tc-critical',
      workItemId: 'lin-99',
      goal: 'Migrate production database schema',
      context: 'Breaking change in schema for user table',
      definitionOfDone: ['Migration runs without error', 'Rollback tested'],
      riskClass: 'C',
      maxBudgetUsd: 5.0,
      allowedTools: ['read', 'bash'],
      branchStrategy: 'chore',
      requiresApproval: true,
      privacyMode: 'local',
      createdAt: '2026-05-15T10:00:00Z',
    }
    expect(contract.riskClass).toBe('C')
    expect(contract.requiresApproval).toBe(true)
  })
})

describe('Delegation type', () => {
  it('accepts a valid Delegation', () => {
    const contract: TaskContract = {
      id: 'tc-1',
      workItemId: 'lin-1',
      goal: 'Fix bug',
      context: 'See JOK-1',
      definitionOfDone: ['Tests pass'],
      riskClass: 'A',
      maxBudgetUsd: 0.5,
      allowedTools: ['read', 'edit'],
      branchStrategy: 'fix',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-15T10:00:00Z',
    }

    const delegation: Delegation = {
      id: 'del-1',
      contract,
      status: 'pending',
      executionRoute: 'runner',
      costEstimateUsd: 0.5,
      createdAt: '2026-05-15T10:00:00Z',
      updatedAt: '2026-05-15T10:00:00Z',
    }
    expect(delegation.status).toBe('pending')
    expect(delegation.executionRoute).toBe('runner')
  })

  it('covers all DelegationStatus values', () => {
    const statuses: DelegationStatus[] = ['pending', 'approved', 'running', 'completed', 'failed', 'cancelled']
    expect(statuses).toHaveLength(6)
  })

  it('covers all ExecutionRoute values', () => {
    const routes: ExecutionRoute[] = ['direct-chat', 'local-agent', 'runner', 'n8n', 'manual']
    expect(routes).toHaveLength(5)
  })
})
