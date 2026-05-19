import { describe, it, expect } from 'vitest'
import { buildSubTaskPrompt, buildSkillBlock } from './delegation-execution'
import type { Delegation } from '@/lib/models/delegation'

function makeDelegation(overrides: Partial<Delegation['contract']> = {}): Delegation {
  return {
    id: 'test-del',
    title: 'Test',
    status: 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    contract: {
      id: 'tc-1',
      workItemId: 'WI-123',
      goal: 'Add a pagination endpoint',
      context: '',
      definitionOfDone: ['Endpoint returns page + total', 'Tests pass'],
      riskClass: 'A',
      maxBudgetUsd: 2,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      orchestratedRunId: 'run-abc',
      skillCategory: 'api-route',
      allowedFilePatterns: ['src/app/api/delegations/**'],
      createdAt: new Date().toISOString(),
      ...overrides,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('buildSubTaskPrompt', () => {
  it('includes the goal', () => {
    const p = buildSubTaskPrompt(makeDelegation())
    expect(p).toContain('Add a pagination endpoint')
  })

  it('includes definition of done items', () => {
    const p = buildSubTaskPrompt(makeDelegation())
    expect(p).toContain('Endpoint returns page + total')
    expect(p).toContain('Tests pass')
  })

  it('includes file scope constraint when allowedFilePatterns set', () => {
    const p = buildSubTaskPrompt(makeDelegation())
    expect(p).toContain('src/app/api/delegations/**')
    expect(p).toContain('File scope')
  })

  it('omits file scope when no patterns', () => {
    const p = buildSubTaskPrompt(makeDelegation({ allowedFilePatterns: [] }))
    expect(p).not.toContain('File scope')
  })

  it('includes skill guide for api-route', () => {
    const p = buildSubTaskPrompt(makeDelegation())
    expect(p).toContain('Skill: API Route')
    expect(p).toContain('NextResponse.json()')
  })

  it('includes skill guide for ui-component', () => {
    const p = buildSubTaskPrompt(makeDelegation({ skillCategory: 'ui-component' }))
    expect(p).toContain('Skill: UI Component')
    expect(p).toContain('Tailwind CSS only')
  })

  it('is shorter than a typical full prompt (focused = less drift)', () => {
    const p = buildSubTaskPrompt(makeDelegation())
    // Sub-task prompts must be lean — under 1500 chars
    expect(p.length).toBeLessThan(1500)
  })

  it('does NOT include PR creation step', () => {
    const p = buildSubTaskPrompt(makeDelegation())
    expect(p).not.toContain('gh pr create')
  })
})

describe('buildSkillBlock', () => {
  it('returns empty string when no skill and no patterns', () => {
    expect(buildSkillBlock(undefined, [])).toBe('')
  })

  it('returns pattern note when only patterns provided', () => {
    const block = buildSkillBlock(undefined, ['src/**'])
    expect(block).toContain('src/**')
    expect(block).toContain('scope drift')
  })

  it('returns skill guide without pattern when no patterns', () => {
    const block = buildSkillBlock('test', [])
    expect(block).toContain('Skill: Testing')
    expect(block).not.toContain('scope drift')
  })

  it('combines pattern + skill guide', () => {
    const block = buildSkillBlock('refactor', ['src/lib/**'])
    expect(block).toContain('src/lib/**')
    expect(block).toContain('Skill: Refactor')
  })
})
