import { describe, expect, it } from 'vitest'
import {
  buildDailyAssistantAction,
  buildDailyAssistantBlockers,
  buildDailyAssistantSteps,
  canStartAutonomously,
  describeAutonomy,
  sortAssistantQueue,
} from './next-action'

const base = {
  pending: 0,
  approved: 0,
  running: 0,
  failed: 0,
  prOpen: 0,
  prMerged: 0,
  authDisabled: false,
  storageMode: 'json',
  approvalMode: 'balanced',
}

describe('buildDailyAssistantAction', () => {
  it('prioritizes failed delegations before all other work', () => {
    expect(buildDailyAssistantAction({ ...base, failed: 1, running: 2 }).id).toBe('fix-failed-delegations')
  })

  it('watches running agents before reviewing open pull requests', () => {
    expect(buildDailyAssistantAction({ ...base, running: 1, prOpen: 2 }).id).toBe('watch-running-agents')
  })

  it('reviews open pull requests before starting new work', () => {
    expect(buildDailyAssistantAction({ ...base, prOpen: 1, approved: 3 }).id).toBe('review-open-prs')
  })

  it('starts approved work before pending approvals', () => {
    expect(buildDailyAssistantAction({ ...base, approved: 2, pending: 4 }).id).toBe('start-approved-work')
  })

  it('falls back to planning a new idea when nothing is waiting', () => {
    expect(buildDailyAssistantAction(base).id).toBe('plan-next-idea')
  })
})

describe('describeAutonomy', () => {
  it('explains active autopilot mode', () => {
    expect(describeAutonomy({ approvalMode: 'autopilot', approved: 2, running: 0, authDisabled: false })).toContain('Autopilot ist aktiv')
  })

  it('explains balanced mode when work is ready', () => {
    expect(describeAutonomy({ approvalMode: 'balanced', approved: 2, running: 0, authDisabled: false })).toContain('Balanced Mode')
  })
})

describe('sortAssistantQueue', () => {
  it('puts failures, running work, approved work and pending work in operator order', () => {
    expect(sortAssistantQueue([
      { id: 'pending', title: 'Pending', status: 'pending', riskClass: 'A', updatedAt: '2026-01-04T00:00:00.000Z' },
      { id: 'approved', title: 'Approved', status: 'approved', riskClass: 'B', updatedAt: '2026-01-03T00:00:00.000Z' },
      { id: 'failed', title: 'Failed', status: 'failed', riskClass: 'A', updatedAt: '2026-01-02T00:00:00.000Z' },
      { id: 'running', title: 'Running', status: 'running', riskClass: 'A', updatedAt: '2026-01-01T00:00:00.000Z' },
    ]).map(item => item.id)).toEqual(['failed', 'running', 'approved', 'pending'])
  })
})

describe('canStartAutonomously', () => {
  it('allows approved non-C work in autopilot mode', () => {
    expect(canStartAutonomously({
      id: 'safe',
      title: 'Safe',
      status: 'approved',
      riskClass: 'A',
      requiresApproval: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, 'autopilot')).toBe(true)
  })

  it('blocks pending, C-risk or approval-required work', () => {
    expect(canStartAutonomously({
      id: 'pending',
      title: 'Pending',
      status: 'pending',
      riskClass: 'A',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, 'autopilot')).toBe(false)
    expect(canStartAutonomously({
      id: 'risky',
      title: 'Risky',
      status: 'approved',
      riskClass: 'C',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, 'autopilot')).toBe(false)
    expect(canStartAutonomously({
      id: 'manual',
      title: 'Manual',
      status: 'approved',
      riskClass: 'A',
      requiresApproval: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, 'autopilot')).toBe(false)
  })
})

describe('buildDailyAssistantSteps', () => {
  it('turns a failed state into a concrete recovery plan', () => {
    const steps = buildDailyAssistantSteps({ ...base, failed: 2 })
    expect(steps.map(step => step.state)).toEqual(['now', 'next', 'later'])
    expect(steps[0].href).toContain('urgent=true')
    expect(steps[0].title).toContain('Fehler')
  })

  it('guides an empty day into idea planning and first delegation', () => {
    const steps = buildDailyAssistantSteps(base)
    expect(steps[0].id).toBe('describe-idea')
    expect(steps[2].title).toContain('Erste kleine Delegation')
  })
})

describe('buildDailyAssistantBlockers', () => {
  it('reports launch and autonomy blockers without hiding warnings', () => {
    const blockers = buildDailyAssistantBlockers(
      { ...base, failed: 1, authDisabled: true, storageMode: 'json' },
      [{ id: 'risky', title: 'Risky', status: 'approved', riskClass: 'C', updatedAt: '2026-01-01T00:00:00.000Z' }],
    )

    expect(blockers.map(blocker => blocker.id)).toEqual([
      'failed-delegations',
      'risk-c-work',
      'auth-disabled',
      'json-storage',
    ])
    expect(blockers[0].severity).toBe('critical')
  })

  it('points directly to the blocking delegation when exactly one failure is visible', () => {
    const blockers = buildDailyAssistantBlockers(
      { ...base, failed: 1 },
      [{ id: 'failed-1', title: 'Budget stopped PR', status: 'failed', riskClass: 'A', updatedAt: '2026-01-01T00:00:00.000Z' }],
    )

    expect(blockers[0].href).toBe('/delegations/failed-1')
    expect(blockers[0].detail).toContain('Budget stopped PR')
  })
})
