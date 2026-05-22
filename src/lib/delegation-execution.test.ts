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

import { buildRetryContext } from './delegation-execution'
import type { Delegation } from '@/lib/models/delegation'

function makeDelegationWithLogs(logs: Delegation['logs']): Delegation {
  return {
    id: 'd1',
    title: 'Test',
    status: 'failed',
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
})
