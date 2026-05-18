import { describe, it, expect } from 'vitest'
import { detectConflicts, conflictingIds } from './conflicts'
import type { Delegation } from '@/lib/models/delegation'

function makeDel(id: string, workItemId: string, status: Delegation['status'] = 'running', briefId?: string): Delegation {
  return {
    id,
    title: id,
    status,
    executionRoute: 'runner',
    costEstimateUsd: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [],
    briefId,
    contract: {
      id: `c-${id}`,
      workItemId,
      goal: 'g',
      context: '',
      definitionOfDone: [],
      allowedTools: [],
      riskClass: 'A',
      branchStrategy: 'feature',
      maxBudgetUsd: 5,
      taskType: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: new Date().toISOString(),
    },
  }
}

describe('detectConflicts', () => {
  it('returns empty when no conflicts', () => {
    expect(detectConflicts([makeDel('a', 'JOK-1'), makeDel('b', 'JOK-2')])).toHaveLength(0)
  })

  it('detects same workItemId conflict', () => {
    const warnings = detectConflicts([makeDel('a', 'JOK-1'), makeDel('b', 'JOK-1')])
    expect(warnings).toHaveLength(1)
    expect(warnings[0].delegationIds).toContain('a')
    expect(warnings[0].delegationIds).toContain('b')
  })

  it('ignores completed delegations', () => {
    const warnings = detectConflicts([makeDel('a', 'JOK-1'), makeDel('b', 'JOK-1', 'completed')])
    expect(warnings).toHaveLength(0)
  })

  it('detects brief conflict', () => {
    const warnings = detectConflicts([makeDel('a', 'JOK-1', 'running', 'brief-1'), makeDel('b', 'JOK-2', 'running', 'brief-1')])
    expect(warnings).toHaveLength(1)
  })
})

describe('conflictingIds', () => {
  it('returns flat set of IDs from all warnings', () => {
    const ids = conflictingIds([{ delegationIds: ['a', 'b'], reason: 'x' }])
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(true)
  })
})
