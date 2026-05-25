import { describe, expect, it } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import { getAgentActivityState } from './AgentActivityExplainer'

const baseDelegation: Delegation = {
  id: 'del-1',
  title: 'Test delegation',
  status: 'pending',
  executionRoute: 'runner',
  costEstimateUsd: 1,
  contract: {
    id: 'contract-1',
    workItemId: 'work-1',
    goal: 'Improve UX',
    context: 'Test context',
    definitionOfDone: ['Done'],
    riskClass: 'B',
    maxBudgetUsd: 1,
    allowedTools: ['edit'],
    branchStrategy: 'feature',
    requiresApproval: true,
    privacyMode: 'local',
    createdAt: '2026-05-24T08:00:00.000Z',
  },
  createdAt: '2026-05-24T08:00:00.000Z',
  updatedAt: '2026-05-24T08:00:00.000Z',
}

describe('getAgentActivityState', () => {
  it('explains pending delegations as waiting for approval', () => {
    const state = getAgentActivityState(baseDelegation)

    expect(state.eyebrow).toBe('Wartet')
    expect(state.title).toContain('wartet auf Freigabe')
    expect(state.steps[1]?.state).toBe('active')
  })

  it('surfaces live execution state for running delegations', () => {
    const state = getAgentActivityState({
      ...baseDelegation,
      status: 'running',
      logs: [{ timestamp: '2026-05-24T08:01:00.000Z', type: 'info', message: 'Running tests' }],
    })

    expect(state.eyebrow).toBe('Live-Ausführung')
    expect(state.latestObservation).toBe('Running tests')
    expect(state.steps[2]?.state).toBe('active')
  })

  it('turns provider failures into a practical next action', () => {
    const state = getAgentActivityState({
      ...baseDelegation,
      status: 'failed',
      errorMessage: 'NoAIProvider configured',
    })

    expect(state.tone).toBe('danger')
    expect(state.body).toContain('KI-Provider')
    expect(state.nextAction).toContain('Settings')
  })

  it('marks completed reviewed PRs as success', () => {
    const state = getAgentActivityState({
      ...baseDelegation,
      status: 'completed',
      summaryReport: {
        keyPoints: ['PR created'],
        changes: ['Updated docs'],
        timeTakenMinutes: 4,
        prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/1',
      },
      criticScore: {
        correctness: 94,
        efficiency: 88,
        drift: 95,
        verdict: 'approved',
        summary: 'Looks good',
        runAt: '2026-05-24T08:02:00.000Z',
      },
    })

    expect(state.tone).toBe('success')
    expect(state.nextAction).toContain('PR prüfen')
    expect(state.steps[4]?.state).toBe('done')
  })
})
