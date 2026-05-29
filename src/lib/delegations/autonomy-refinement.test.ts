import { describe, expect, it } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import {
  assessDelegationActionability,
  buildAutonomyRefinementPatch,
} from './autonomy-refinement'

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  const now = '2026-05-28T12:00:00.000Z'
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Wartung des Servers',
    status: 'approved',
    executionRoute: 'manual',
    costEstimateUsd: 0.1,
    contract: {
      id: 'contract-1',
      workItemId: 'work-1',
      goal: 'Wartung des Servers',
      context: '',
      taskType: 'feature',
      definitionOfDone: ['Wartung des Servers is implemented', 'Tests pass', 'No TypeScript errors'],
      riskClass: 'A',
      maxBudgetUsd: 0.1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: now,
    },
    logs: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('autonomy refinement', () => {
  it('marks vague delegations as not actionable', () => {
    const result = assessDelegationActionability(makeDelegation())
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('zu vage')
  })

  it('builds a concrete patch with DoD and file boundaries', () => {
    const patch = buildAutonomyRefinementPatch(makeDelegation()).patch

    expect(patch.title).toContain('Readiness')
    expect(patch.executionRoute).toBe('runner')
    expect(patch.contract?.definitionOfDone.length).toBeGreaterThanOrEqual(3)
    expect(patch.contract?.allowedFilePatterns?.length).toBeGreaterThan(0)
    expect(patch.contract?.context).toContain('[ForgePilot autonomy-refined]')
  })

  it('keeps already concrete delegations actionable', () => {
    const concrete = makeDelegation({
      title: 'ToDo WebApp: Filterleiste verbessern',
      contract: {
        ...makeDelegation().contract,
        goal: 'Verbessere die Filterleiste der ToDo-Demo-App mit Alle/Aktiv/Erledigt und stabiler localStorage-Persistenz.',
        definitionOfDone: [
          'Filter Alle/Aktiv/Erledigt sind sichtbar.',
          'localStorage-Persistenz bleibt erhalten.',
        ],
        allowedFilePatterns: ['src/app/demo/todo-planner/**'],
      },
    })

    expect(assessDelegationActionability(concrete).ok).toBe(true)
  })
})
