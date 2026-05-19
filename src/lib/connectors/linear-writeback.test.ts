import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { postLinearCompletionComment } from './linear-writeback'
import type { Delegation } from '@/lib/models/delegation'

// Prevent readStoredApiKeys from reading real config/api-keys.json
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => { throw new Error('mocked') }),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
  },
}))

const baseDelegation: Delegation = {
  id: 'del-1',
  title: 'Build the feature',
  status: 'completed',
  executionRoute: 'local-agent',
  costEstimateUsd: 0.5,
  actualCostUsd: 0.12,
  contract: {
    id: 'contract-1',
    workItemId: 'ENG-42',
    goal: 'Build the feature',
    context: 'Context here',
    definitionOfDone: ['Tests pass'],
    riskClass: 'A',
    maxBudgetUsd: 5,
    allowedTools: ['Read'],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: '2026-05-17T00:00:00Z',
  },
  summaryReport: {
    keyPoints: ['Feature implemented', 'Tests green'],
    changes: [],
    timeTakenMinutes: 12,
    prUrl: 'https://github.com/org/repo/pull/42',
  },
  logs: [],
  createdAt: '2026-05-17T00:00:00Z',
  updatedAt: '2026-05-17T00:00:00Z',
}

describe('postLinearCompletionComment', () => {
  let savedKey: string | undefined

  beforeEach(() => {
    savedKey = process.env.LINEAR_API_KEY
    delete process.env.LINEAR_API_KEY
  })

  afterEach(() => {
    if (savedKey !== undefined) process.env.LINEAR_API_KEY = savedKey
    else delete process.env.LINEAR_API_KEY
  })

  it('returns error when LINEAR_API_KEY is not configured', async () => {
    const result = await postLinearCompletionComment(baseDelegation)
    expect(result.success).toBe(false)
    expect(result.error).toContain('LINEAR_API_KEY')
  })

  it('returns error for non-Linear workItemId format', async () => {
    const fetcher = async () => new Response('{}', { status: 200 })
    process.env.LINEAR_API_KEY = 'lin_test_key'
    const nonLinearDelegation = {
      ...baseDelegation,
      contract: { ...baseDelegation.contract, workItemId: 'not-a-linear-id' },
    }
    const result = await postLinearCompletionComment(nonLinearDelegation, fetcher)
    expect(result.success).toBe(false)
    expect(result.error).toContain('not a Linear identifier')
  })

  it('returns error when issue resolution fails', async () => {
    process.env.LINEAR_API_KEY = 'lin_test_key'
    const fetcher = async () =>
      new Response(
        JSON.stringify({ errors: [{ message: 'Issue not found' }] }),
        { status: 200 },
      )
    const result = await postLinearCompletionComment(baseDelegation, fetcher)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Issue not found')
  })

  it('posts a comment and returns success with commentId', async () => {
    process.env.LINEAR_API_KEY = 'lin_test_key'
    let callCount = 0
    const fetcher = async (_url: RequestInfo | URL, options?: RequestInit) => {
      callCount++
      const body = JSON.parse(options?.body as string) as { query: string }
      if (body.query.includes('IssueByIdentifier')) {
        return new Response(
          JSON.stringify({ data: { issue: { id: 'uuid-issue-1', identifier: 'ENG-42' } } }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({ data: { commentCreate: { success: true, comment: { id: 'comment-99' } } } }),
        { status: 200 },
      )
    }
    const result = await postLinearCompletionComment(baseDelegation, fetcher)
    expect(result.success).toBe(true)
    expect(result.commentId).toBe('comment-99')
    expect(callCount).toBe(2)
  })

  it('returns error when fetcher throws', async () => {
    process.env.LINEAR_API_KEY = 'lin_test_key'
    const fetcher = async () => { throw new Error('Network error') }
    const result = await postLinearCompletionComment(baseDelegation, fetcher)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Network error')
  })
})
