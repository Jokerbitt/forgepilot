import { describe, it, expect } from 'vitest'
import { buildStarterPlan } from './project-starter-plan'
import type { ProjectBrief } from '@/lib/models/project-brief'

const baseBrief: ProjectBrief = {
  id: 'b1',
  title: 'My App',
  problemStatement: 'No solution exists',
  desiredOutcome: 'Users can manage work',
  rawIdea: 'Build a management tool',
  targetAudience: 'Developers',
  status: 'draft',
  scope: 'standard',
  researchMode: 'quick',
  privacyMode: 'local',
  constraints: [],
  requirements: [],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: '',
    mode: 'quick',
    privacyMode: 'local',
    preferredExecutor: 'agent',
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

describe('buildStarterPlan', () => {
  it('returns 3 milestones for a generic project', () => {
    const plan = buildStarterPlan(baseBrief)
    expect(plan.milestones).toHaveLength(3)
    expect(plan.milestones[0].status).toBe('planned')
  })

  it('returns work packages with required fields', () => {
    const plan = buildStarterPlan(baseBrief)
    for (const wp of plan.workPackages) {
      expect(wp.title).toBeTruthy()
      expect(wp.riskClass).toMatch(/^[ABC]$/)
      expect(typeof wp.estimatedHours).toBe('number')
      expect(Array.isArray(wp.definitionOfDone)).toBe(true)
      expect(Array.isArray(wp.dependsOn)).toBe(true)
      expect(wp.status).toMatch(/ready|backlog/)
    }
  })

  it('first generic work package is risk A and ready', () => {
    const plan = buildStarterPlan(baseBrief)
    const first = plan.workPackages[0]
    expect(first.riskClass).toBe('A')
    expect(first.status).toBe('ready')
    expect(first.priority).toBe('critical')
  })

  it('detects todo project by title keyword', () => {
    const todoBrief: ProjectBrief = { ...baseBrief, title: 'My Todo App' }
    const plan = buildStarterPlan(todoBrief)
    expect(plan.milestones[0].title).toContain('Todo')
  })

  it('detects todo project by rawIdea keyword', () => {
    const todoBrief: ProjectBrief = { ...baseBrief, title: 'Planner', rawIdea: 'A task planner' }
    const plan = buildStarterPlan(todoBrief)
    expect(plan.workPackages.some(wp => wp.tags?.includes('todo'))).toBe(true)
  })

  it('includes platform label in milestone description when targetPlatform=mobile', () => {
    const mobileBrief: ProjectBrief = { ...baseBrief, targetPlatform: 'mobile' }
    const plan = buildStarterPlan(mobileBrief)
    expect(plan.milestones[0].description).toContain('Mobile')
  })

  it('includes persistence label in milestone description when persistenceStrategy=sqlite', () => {
    const sqliteBrief: ProjectBrief = { ...baseBrief, persistenceStrategy: 'sqlite' }
    const plan = buildStarterPlan(sqliteBrief)
    const hasSqlite = plan.milestones.some(m => m.description.includes('SQLite'))
    expect(hasSqlite).toBe(true)
  })

  it('defaults to webapp platform when targetPlatform is not set', () => {
    const plan = buildStarterPlan(baseBrief)
    expect(plan.milestones[0].description).toContain('Webapp')
  })

  it('defaults to postgres persistence when persistenceStrategy is not set', () => {
    const plan = buildStarterPlan(baseBrief)
    const persisted = plan.milestones.some(m => m.description.includes('PostgreSQL'))
    expect(persisted).toBe(true)
  })

  it('uses brief title in first work package description', () => {
    const plan = buildStarterPlan({ ...baseBrief, title: 'TaskFlow' })
    expect(plan.workPackages[0].description).toContain('TaskFlow')
  })

  it('no work package has riskClass C (starter plan stays safe)', () => {
    const plan = buildStarterPlan(baseBrief)
    const hasC = plan.workPackages.some(wp => wp.riskClass === 'C')
    expect(hasC).toBe(false)
  })

  it('all milestoneIndex values are valid indices', () => {
    const plan = buildStarterPlan(baseBrief)
    const maxIndex = plan.milestones.length - 1
    for (const wp of plan.workPackages) {
      expect(wp.milestoneIndex).toBeGreaterThanOrEqual(0)
      expect(wp.milestoneIndex).toBeLessThanOrEqual(maxIndex)
    }
  })
})
