import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSubTaskPrompt, buildSkillBlock, buildRetryContext } from './delegation-execution'
import type { Delegation } from '@/lib/models/delegation'

const mockReadKnowledgeCards = vi.fn().mockReturnValue([])
vi.mock('@/lib/knowledge/knowledge-card', () => ({
  readKnowledgeCards: () => mockReadKnowledgeCards(),
}))

beforeEach(() => {
  mockReadKnowledgeCards.mockReturnValue([])
})

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

function makeDelegationWithLogs(logs: Delegation['logs']): Delegation {
  return {
    id: 'd1',
    title: 'Test',
    status: 'failed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs,
    contract: {
      id: 'tc1',
      createdAt: new Date().toISOString(),
      workItemId: 'WI-1',
      goal: 'Test goal',
      context: '',
      riskClass: 'A',
      requiresApproval: false,
      branchStrategy: 'feature',
      privacyMode: 'local',
      maxBudgetUsd: 1,
      definitionOfDone: [],
      allowedTools: [],
    },
  } as Delegation
}

describe('buildRetryContext', () => {
  it('returns empty string when no logs', () => {
    const d = makeDelegationWithLogs([])
    expect(buildRetryContext(d)).toBe('')
  })

  it('returns empty string when only info/success logs', () => {
    const d = makeDelegationWithLogs([
      { timestamp: new Date().toISOString(), type: 'info', message: 'Started' },
      { timestamp: new Date().toISOString(), type: 'success', message: 'Done' },
    ])
    expect(buildRetryContext(d)).toBe('')
  })

  it('returns retry block with error messages', () => {
    const d = makeDelegationWithLogs([
      { timestamp: new Date().toISOString(), type: 'error', message: 'TypeScript error: TS2345' },
    ])
    const ctx = buildRetryContext(d)
    expect(ctx).toContain('Previous Attempt Failed')
    expect(ctx).toContain('TypeScript error: TS2345')
  })

  it('includes only last 5 error logs', () => {
    const logs = Array.from({ length: 8 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      type: 'error' as const,
      message: `Error ${i + 1}`,
    }))
    const d = makeDelegationWithLogs(logs)
    const ctx = buildRetryContext(d)
    expect(ctx).toContain('Error 4')
    expect(ctx).toContain('Error 8')
    expect(ctx).not.toContain('Error 1')
    expect(ctx).not.toContain('Error 2')
    expect(ctx).not.toContain('Error 3')
  })

  it('truncates long error messages to 200 chars', () => {
    const long = 'x'.repeat(300)
    const d = makeDelegationWithLogs([
      { timestamp: new Date().toISOString(), type: 'error', message: long },
    ])
    const ctx = buildRetryContext(d)
    const errorLine = ctx.split('\n').find(l => l.startsWith('- '))!
    expect(errorLine.length).toBeLessThanOrEqual(202) // "- " + 200 chars
  })

  it('includes critic feedback block when criticScore is present', () => {
    const d: Delegation = {
      ...makeDelegationWithLogs([
        { timestamp: new Date().toISOString(), type: 'error', message: 'tests failed' },
      ]),
      criticScore: {
        correctness: 45,
        efficiency: 60,
        drift: 30,
        verdict: 'needs-revision',
        summary: 'Tests were missing',
        runAt: new Date().toISOString(),
      },
    }
    const ctx = buildRetryContext(d)
    expect(ctx).toContain('Critic Feedback')
    expect(ctx).toContain('needs-revision')
    expect(ctx).toContain('Tests were missing')
  })

  it('includes failure lessons from past runs when knowledge cards have matching tags', () => {
    mockReadKnowledgeCards.mockReturnValue([
      {
        id: 'old-lesson',
        title: '[FAILED] similar task',
        content: '- avoid using any types',
        tags: ['failure-lesson', '/my-repo', 'B', 'local-agent'],
        sourceId: 'other-del',
        source: 'delegation',
        createdAt: new Date(Date.now() - 60000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])

    const d: Delegation = {
      ...makeDelegationWithLogs([
        { timestamp: new Date().toISOString(), type: 'error', message: 'compile error' },
      ]),
      targetRepo: '/my-repo',
    }
    const ctx = buildRetryContext(d)
    expect(ctx).toContain('Lessons from Similar Past Failures')
    expect(ctx).toContain('avoid using any types')
  })

  it('does NOT include lessons from the same delegation (no self-injection)', () => {
    mockReadKnowledgeCards.mockReturnValue([
      {
        id: 'self-lesson',
        title: '[FAILED] same task',
        content: '- self lesson',
        tags: ['failure-lesson', 'unknown', 'B'],
        sourceId: 'd1', // same as the delegation id in makeDelegationWithLogs
        source: 'delegation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])

    const d = makeDelegationWithLogs([
      { timestamp: new Date().toISOString(), type: 'error', message: 'compile error' },
    ])
    const ctx = buildRetryContext(d)
    // Self-lessons are excluded
    expect(ctx).not.toContain('Lessons from Similar Past Failures')
  })
})
