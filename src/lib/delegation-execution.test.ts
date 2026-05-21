import { describe, it, expect } from 'vitest'
import { buildSubTaskPrompt, buildSkillBlock, buildPrompt } from './delegation-execution'
import type { Delegation } from '@/lib/models/delegation'
import type { MemoryCard } from '@/lib/knowledge/types'

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

describe('buildPrompt', () => {
  function makeFullDelegation(overrides: Partial<Delegation['contract']> = {}): Delegation {
    return {
      id: 'del-full',
      title: 'Full Task',
      status: 'approved',
      executionRoute: 'local-agent',
      costEstimateUsd: 0,
      contract: {
        id: 'tc-full',
        workItemId: 'WI-999',
        goal: 'Add a pagination endpoint',
        context: '',
        definitionOfDone: ['Returns 200', 'Tests pass'],
        riskClass: 'A',
        maxBudgetUsd: 5,
        allowedTools: [],
        branchStrategy: 'feature',
        requiresApproval: false,
        privacyMode: 'local',
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  function makeCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
    return {
      id: 'card-1',
      type: 'learning',
      title: 'Test Learning',
      body: 'Important past learning about this topic',
      sourceIds: ['del-1'],
      tags: [],
      privacyClass: 'internal',
      confidence: 'high',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
  }

  it('includes the goal', () => {
    const p = buildPrompt(makeFullDelegation())
    expect(p).toContain('Add a pagination endpoint')
  })

  it('includes definition of done items', () => {
    const p = buildPrompt(makeFullDelegation())
    expect(p).toContain('Returns 200')
    expect(p).toContain('Tests pass')
  })

  it('is identical to output without contextCards when no cards passed', () => {
    const del = makeFullDelegation()
    const withoutCards = buildPrompt(del)
    const withUndefined = buildPrompt(del, undefined)
    expect(withoutCards).toBe(withUndefined)
  })

  it('does NOT include learnings block when no contextCards', () => {
    const p = buildPrompt(makeFullDelegation())
    expect(p).not.toContain('Relevant Past Learnings')
  })

  it('does NOT include learnings block when empty contextCards array', () => {
    const p = buildPrompt(makeFullDelegation(), [])
    expect(p).not.toContain('Relevant Past Learnings')
  })

  it('includes learnings block when contextCards are provided', () => {
    const card = makeCard({ title: 'Key Pattern', body: 'Always validate input at the boundary' })
    const p = buildPrompt(makeFullDelegation(), [card])
    expect(p).toContain('Relevant Past Learnings')
    expect(p).toContain('Key Pattern')
    expect(p).toContain('Always validate input at the boundary')
  })

  it('truncates card body to 200 chars in learnings block', () => {
    const longBody = 'x'.repeat(300)
    const card = makeCard({ title: 'Long Card', body: longBody })
    const p = buildPrompt(makeFullDelegation(), [card])
    expect(p).toContain('x'.repeat(200))
    expect(p).not.toContain('x'.repeat(201))
  })

  it('places learnings block after ## Task and before ## Definition of Done', () => {
    const card = makeCard({ title: 'Past Pattern', body: 'Use repository pattern' })
    const p = buildPrompt(makeFullDelegation(), [card])
    const taskIdx = p.indexOf('## Task')
    const learningsIdx = p.indexOf('## Relevant Past Learnings')
    const dodIdx = p.indexOf('## Definition of Done')
    expect(taskIdx).toBeGreaterThan(-1)
    expect(learningsIdx).toBeGreaterThan(taskIdx)
    expect(dodIdx).toBeGreaterThan(learningsIdx)
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
