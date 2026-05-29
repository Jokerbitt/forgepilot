import { describe, expect, it } from 'vitest'
import { buildProjectPipelineSummary } from './project-pipeline'
import type { Delegation } from '@/lib/models/delegation'
import type { WorkPackage } from '@/lib/models/milestone'
import type { ProjectBrief } from '@/lib/models/project-brief'

const brief = {
  id: 'brief-1',
  title: 'TaskFlow',
} as ProjectBrief

function wp(overrides: Partial<WorkPackage>): WorkPackage {
  return {
    id: 'wp-1',
    briefId: 'brief-1',
    milestoneId: 'm1',
    title: 'First slice',
    description: 'Build first slice',
    definitionOfDone: ['Done'],
    riskClass: 'A',
    priority: 'critical',
    estimatedHours: 2,
    dependsOn: [],
    status: 'ready',
    delegationIds: [],
    tags: [],
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...overrides,
  }
}

function delegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: 'del-1',
    title: 'Delegation',
    status: 'completed',
    contract: {
      id: 'contract-1',
      workItemId: 'wp-1',
      goal: 'Build',
      context: '',
      taskType: 'feature',
      riskClass: 'A',
      definitionOfDone: ['Done'],
      maxBudgetUsd: 1,
      allowedTools: ['bash'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-29T10:00:00.000Z',
    },
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    logs: [],
    qualityCheck: { verdict: 'passed', overallScore: 100, criteria: [], checkedAt: '2026-05-29T10:00:00.000Z' },
    criticScore: { verdict: 'approved', correctness: 100, efficiency: 90, drift: 100, summary: 'ok', runAt: '2026-05-29T10:00:00.000Z' },
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...overrides,
  }
}

describe('buildProjectPipelineSummary', () => {
  it('surfaces the next safe slice for a larger app plan', () => {
    const summary = buildProjectPipelineSummary({
      briefs: [brief],
      workPackages: [wp({ id: 'wp-1', title: 'Foundation' }), wp({ id: 'wp-2', title: 'Persistence', priority: 'high' })],
      delegations: [],
    })

    expect(summary.safeSliceCount).toBe(2)
    expect(summary.nextCandidate?.title).toBe('Foundation')
    expect(summary.recommendation).toContain('Foundation')
  })

  it('blocks dependent slices until dependency delegation passed quality and critic gates', () => {
    const summary = buildProjectPipelineSummary({
      briefs: [brief],
      workPackages: [
        wp({ id: 'wp-1', title: 'Foundation', status: 'ready' }),
        wp({ id: 'wp-2', title: 'Persistence', dependsOn: ['Foundation'], priority: 'high' }),
      ],
      delegations: [],
    })

    expect(summary.safeSliceCount).toBe(1)
    expect(summary.blockedByDependencyCount).toBe(1)
    expect(summary.nextCandidate?.id).toBe('wp-1')
  })

  it('unlocks dependent slices after dependency passed', () => {
    const summary = buildProjectPipelineSummary({
      briefs: [brief],
      workPackages: [
        wp({ id: 'wp-1', title: 'Foundation', status: 'ready' }),
        wp({ id: 'wp-2', title: 'Persistence', dependsOn: ['Foundation'], priority: 'high' }),
      ],
      delegations: [delegation({ contract: { ...delegation({}).contract, workItemId: 'wp-1' } })],
    })

    expect(summary.completedSliceCount).toBe(1)
    expect(summary.nextCandidate?.id).toBe('wp-2')
  })

  it('keeps dependent slices blocked until dependency PR is merged', () => {
    const summary = buildProjectPipelineSummary({
      briefs: [brief],
      workPackages: [
        wp({ id: 'wp-1', title: 'Foundation', status: 'ready' }),
        wp({ id: 'wp-2', title: 'Persistence', dependsOn: ['Foundation'], priority: 'high' }),
      ],
      delegations: [
        delegation({
          contract: { ...delegation({}).contract, workItemId: 'wp-1' },
          summaryReport: {
            keyPoints: ['done'],
            changes: [],
            timeTakenMinutes: 1,
            prUrl: 'https://github.com/org/repo/pull/1',
            prState: 'open',
          },
        }),
      ],
    })

    expect(summary.nextCandidate).toBeNull()
    expect(summary.blockedByDependencyCount).toBe(1)
  })

  it('unlocks dependent slices after dependency PR is merged', () => {
    const summary = buildProjectPipelineSummary({
      briefs: [brief],
      workPackages: [
        wp({ id: 'wp-1', title: 'Foundation', status: 'ready' }),
        wp({ id: 'wp-2', title: 'Persistence', dependsOn: ['Foundation'], priority: 'high' }),
      ],
      delegations: [
        delegation({
          contract: { ...delegation({}).contract, workItemId: 'wp-1' },
          summaryReport: {
            keyPoints: ['done'],
            changes: [],
            timeTakenMinutes: 1,
            prUrl: 'https://github.com/org/repo/pull/1',
            prState: 'merged',
          },
        }),
      ],
    })

    expect(summary.nextCandidate?.id).toBe('wp-2')
  })

  it('ignores risk C packages for autonomous larger app work', () => {
    const summary = buildProjectPipelineSummary({
      briefs: [brief],
      workPackages: [wp({ id: 'wp-c', title: 'Dangerous', riskClass: 'C' })],
      delegations: [],
    })

    expect(summary.safeSliceCount).toBe(0)
    expect(summary.nextCandidate).toBeNull()
  })
})
