import { describe, expect, it } from 'vitest'
import type { ProjectBrief } from '@/lib/models/project-brief'
import { buildProjectBriefsWorkspaceViewModel } from '@/lib/project-briefs-workspace'

function brief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    id: 'brief-1',
    title: 'ForgePilot Premium UI',
    status: 'in_review',
    createdAt: '2026-05-17T10:00:00.000Z',
    updatedAt: '2026-05-18T08:00:00.000Z',
    rawIdea: 'Build a premium SaaS workspace.',
    problemStatement: 'The product should not feel like a prototype.',
    targetAudience: 'AI operators',
    desiredOutcome: 'Clear work orchestration.',
    constraints: [],
    scope: 'standard',
    researchMode: 'standard',
    privacyMode: 'hybrid',
    requirements: [
      {
        id: 'req-1',
        briefId: 'brief-1',
        type: 'functional',
        title: 'Professional navigation',
        description: 'Navigation must be clear.',
        priority: 'must',
        source: 'user_input',
        findingIds: [],
        status: 'accepted',
      },
    ],
    useCases: [],
    nonGoals: [],
    risks: [
      {
        id: 'risk-1',
        briefId: 'brief-1',
        title: 'Prototype perception',
        description: 'The UI may look cheap.',
        probability: 'medium',
        impact: 'high',
        isOpenAssumption: true,
        findingIds: [],
      },
    ],
    researchRunIds: [],
    delegationIds: [],
    researchBriefDraft: {
      title: 'Research Brief',
      mode: 'standard',
      privacyMode: 'hybrid',
      preferredExecutor: 'agent',
      researchQuestions: [],
      searchTerms: [],
      preferredSourceTypes: ['docs'],
      excludeCriteria: [],
    },
    ...overrides,
  }
}

describe('buildProjectBriefsWorkspaceViewModel', () => {
  it('surfaces metrics, risk signals and the next action', () => {
    const viewModel = buildProjectBriefsWorkspaceViewModel([
      brief(),
      brief({
        id: 'brief-2',
        title: 'Archived',
        status: 'archived',
        risks: [],
        updatedAt: '2026-05-16T08:00:00.000Z',
      }),
    ], new Date('2026-05-18T12:00:00.000Z'))

    expect(viewModel.metrics.active).toBe(1)
    expect(viewModel.metrics.reviewCount).toBe(1)
    expect(viewModel.metrics.openRiskCount).toBe(1)
    expect(viewModel.nextAction?.title).toBe('Offene Annahmen klaeren')
    expect(viewModel.active[0].riskLevel).toBe('high')
    expect(viewModel.active[0].readiness).toBeGreaterThan(60)
    expect(viewModel.archived).toHaveLength(1)
  })
})
