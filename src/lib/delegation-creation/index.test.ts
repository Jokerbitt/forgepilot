import { describe, it, expect, vi } from 'vitest'
import { createDelegationFromBrief } from './index'
import type { ProjectBrief } from '@/lib/models/project-brief'

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(() => ({
    create: vi.fn(async (d: unknown) => d),
  })),
  SINGLE_TENANT_USER_ID: 'local-user',
}))

const mockBrief: ProjectBrief = {
  id: 'brief-1',
  title: 'Test Feature',
  status: 'accepted',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rawIdea: 'A test idea long enough to pass validation',
  problemStatement: 'Test problem',
  targetAudience: 'Devs',
  desiredOutcome: 'Working test',
  constraints: ['no new deps'],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
  requirements: [],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research Brief: Test Feature',
    mode: 'standard',
    privacyMode: 'local',
    preferredExecutor: 'agent',
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
}

describe('createDelegationFromBrief', () => {
  it('creates a delegation with correct shape', async () => {
    const delegation = await createDelegationFromBrief(mockBrief)
    expect(delegation).toHaveProperty('id')
    expect(delegation).toHaveProperty('briefId', 'brief-1')
    expect(delegation.status).toBe('pending')
    expect(delegation.contract).toHaveProperty('goal', 'Test Feature')
    expect(delegation.contract.riskClass).toBe('A')
  })

  it('uses desiredOutcome as definitionOfDone when no accepted requirements', async () => {
    const delegation = await createDelegationFromBrief(mockBrief)
    expect(delegation.contract.definitionOfDone).toContain('Working test')
  })

  it('uses accepted requirement titles as definitionOfDone when present', async () => {
    const briefWithReqs: ProjectBrief = {
      ...mockBrief,
      requirements: [
        {
          id: 'req-1',
          briefId: 'brief-1',
          type: 'functional',
          title: 'Requirement A',
          description: 'Desc A',
          priority: 'must',
          source: 'user_input',
          findingIds: [],
          status: 'accepted',
        },
      ],
    }
    const delegation = await createDelegationFromBrief(briefWithReqs)
    expect(delegation.contract.definitionOfDone).toContain('Requirement A')
    expect(delegation.contract.definitionOfDone).not.toContain('Working test')
  })

  it('includes constraints in context when present', async () => {
    const delegation = await createDelegationFromBrief(mockBrief)
    expect(delegation.contract.context).toContain('no new deps')
  })

  it('maps privacyMode correctly', async () => {
    const cloudBrief: ProjectBrief = { ...mockBrief, privacyMode: 'cloud' }
    const delegation = await createDelegationFromBrief(cloudBrief)
    expect(delegation.contract.privacyMode).toBe('public')
  })
})
