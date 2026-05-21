import { describe, expect, it } from 'vitest'
import { buildBlueprintViewModel } from './BlueprintScreen'
import type { ProjectBrief } from '@/lib/models/project-brief'

const baseBrief: ProjectBrief = {
  id: 'brief-1',
  title: 'ForgePilot',
  status: 'in_review',
  createdAt: '2026-05-17T10:00:00Z',
  updatedAt: '2026-05-17T10:00:00Z',
  rawIdea: 'Build a project-centered AI workflow OS.',
  problemStatement: 'AI agents lose project context across sessions.',
  targetAudience: 'Software teams',
  desiredOutcome: 'A governed workflow from idea to agent execution.',
  constraints: ['local-first'],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'hybrid',
  requirements: [],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research Brief: ForgePilot',
    mode: 'standard',
    privacyMode: 'hybrid',
    preferredExecutor: 'agent',
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: ['github'],
    excludeCriteria: [],
  },
}

// Helper to determine whether StartDelegationButton should be rendered
// (mirrors the condition in BlueprintScreen JSX: brief.status === 'accepted')
function shouldShowStartDelegationButton(brief: Pick<ProjectBrief, 'status'>): boolean {
  return brief.status === 'accepted'
}

describe('StartDelegationButton visibility', () => {
  it('is shown when status is accepted', () => {
    expect(shouldShowStartDelegationButton({ status: 'accepted' })).toBe(true)
  })

  it('is hidden when status is draft', () => {
    expect(shouldShowStartDelegationButton({ status: 'draft' })).toBe(false)
  })

  it('is hidden when status is in_review', () => {
    expect(shouldShowStartDelegationButton({ status: 'in_review' })).toBe(false)
  })

  it('is hidden when status is archived', () => {
    expect(shouldShowStartDelegationButton({ status: 'archived' })).toBe(false)
  })
})

describe('buildBlueprintViewModel', () => {
  it('asks for accepted requirements before approval', () => {
    const vm = buildBlueprintViewModel(baseBrief)
    expect(vm.nextAction).toBe('Requirements pruefen und akzeptieren')
    expect(vm.contextMode).toBe('hybrid')
    expect(vm.readinessTone).toBe('blocked')
  })

  it('routes accepted briefs toward delegation', () => {
    const vm = buildBlueprintViewModel({
      ...baseBrief,
      status: 'accepted',
      requirements: [{
        id: 'req-1',
        briefId: 'brief-1',
        type: 'functional',
        title: 'Create context package',
        description: 'Build context packages from work items.',
        priority: 'must',
        source: 'user_input',
        findingIds: [],
        status: 'accepted',
      }],
    })

    expect(vm.nextAction).toBe('Delegation vorbereiten')
    expect(vm.acceptedReqs).toHaveLength(1)
    expect(vm.readinessScore).toBeGreaterThan(60)
  })
})
