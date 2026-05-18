import { describe, it, expect, vi } from 'vitest'
import { runPMAgent } from './pm-agent'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { Milestone, WorkPackage } from '@/lib/models/milestone'
import type { Delegation } from '@/lib/models/delegation'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const brief: ProjectBrief = {
  id: 'brief-1',
  title: 'ForgePilot',
  status: 'accepted',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  rawIdea: 'AI workflow OS',
  problemStatement: 'Too much manual work',
  targetAudience: 'Developers',
  desiredOutcome: 'Automated pipeline',
  constraints: [],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
  requirements: [
    { id: 'r1', briefId: 'brief-1', type: 'functional', title: 'Intake', description: 'n8n intake', priority: 'must', source: 'user_input', findingIds: [], status: 'accepted' },
  ],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research',
    mode: 'standard',
    privacyMode: 'local',
    preferredExecutor: 'agent',
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
}

const milestone: Milestone = {
  id: 'ms-1',
  briefId: 'brief-1',
  title: 'Setup',
  description: 'Initial project setup',
  goal: 'Repo ready',
  targetWeek: 1,
  status: 'planned',
  workPackageIds: ['wp-1'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const workPackage: WorkPackage = {
  id: 'wp-1',
  milestoneId: 'ms-1',
  briefId: 'brief-1',
  title: 'Init repo',
  description: 'Create Next.js project',
  definitionOfDone: ['Repo created', 'CI green'],
  riskClass: 'A',
  priority: 'high',
  estimatedHours: 4,
  dependsOn: [],
  status: 'backlog',
  delegationIds: [],
  tags: ['setup'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const delegation: Delegation = {
  id: 'del-1',
  title: 'Init repo delegation',
  contract: {
    id: 'contract-1',
    workItemId: 'wp-1',
    goal: 'Create Next.js project',
    context: '',
    definitionOfDone: [],
    riskClass: 'A',
    maxBudgetUsd: 1,
    allowedTools: [],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: '2026-01-01T00:00:00Z',
  },
  status: 'running',
  executionRoute: 'local-agent',
  costEstimateUsd: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const validPayload = {
  summary: 'Project is in early setup phase. One work package ready for delegation.',
  overallHealth: 'green' as const,
  reviews: [
    {
      workPackageId: 'wp-1',
      title: 'Init repo',
      recommendedPriority: 'high' as const,
      currentStatus: 'backlog',
      flags: [],
      reasoning: 'Foundation work needed first',
      suggestedNextAction: 'delegate_now' as const,
    },
  ],
  nextDelegations: [
    {
      workPackageId: 'wp-1',
      title: 'Init repo',
      rationale: 'Blocks all other work',
      estimatedHours: 4,
      riskClass: 'A',
    },
  ],
  blockers: [],
  recommendations: ['Start with setup milestone'],
}

function makeApiResponse(content: string, status = 200) {
  return new Response(
    JSON.stringify({
      id: 'msg-1',
      content: [{ type: 'text', text: content }],
      usage: { input_tokens: 200, output_tokens: 400 },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('runPMAgent', () => {
  it('parses a valid JSON response into PMAgentResult', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    const result = await runPMAgent([brief], [milestone], [workPackage], [delegation], {
      apiKey: 'sk-test',
      fetcher: fetcher as unknown as typeof fetch,
    })

    expect(result.summary).toContain('setup phase')
    expect(result.overallHealth).toBe('green')
    expect(result.reviews).toHaveLength(1)
    expect(result.reviews[0].workPackageId).toBe('wp-1')
    expect(result.nextDelegations).toHaveLength(1)
    expect(result.nextDelegations[0].riskClass).toBe('A')
    expect(result.blockers).toHaveLength(0)
    expect(result.recommendations).toHaveLength(1)
    expect(result.tokenUsage.promptTokens).toBe(200)
    expect(result.tokenUsage.completionTokens).toBe(400)
  })

  it('includes runAt timestamp in result', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))
    const before = new Date().toISOString()

    const result = await runPMAgent([brief], [milestone], [workPackage], [], {
      apiKey: 'sk-test',
      fetcher: fetcher as unknown as typeof fetch,
    })

    const after = new Date().toISOString()
    expect(result.runAt >= before).toBe(true)
    expect(result.runAt <= after).toBe(true)
  })

  it('strips markdown fences from response before parsing', async () => {
    const wrapped = '```json\n' + JSON.stringify(validPayload) + '\n```'
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(wrapped))

    const result = await runPMAgent([brief], [milestone], [workPackage], [], {
      apiKey: 'sk-test',
      fetcher: fetcher as unknown as typeof fetch,
    })

    expect(result.overallHealth).toBe('green')
  })

  it('throws when response body is not valid JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse('Not valid JSON'))

    await expect(
      runPMAgent([brief], [milestone], [workPackage], [], {
        apiKey: 'sk-test',
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).rejects.toThrow('Could not parse PM agent response as JSON')
  })

  it('throws on non-200 API response with status code in message', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    )

    await expect(
      runPMAgent([brief], [milestone], [workPackage], [], {
        apiKey: 'bad-key',
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).rejects.toThrow('Anthropic API 401')
  })

  it('sends request to Anthropic messages endpoint with correct headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await runPMAgent([brief], [milestone], [workPackage], [], {
      apiKey: 'sk-test',
      fetcher: fetcher as unknown as typeof fetch,
    })

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
        }),
      }),
    )
  })

  it('defaults to claude-sonnet-4-6 model', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await runPMAgent([brief], [milestone], [workPackage], [], {
      apiKey: 'sk-test',
      fetcher: fetcher as unknown as typeof fetch,
    })

    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string) as { model: string }
    expect(body.model).toBe('claude-sonnet-4-6')
  })

  it('accepts a custom model override', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await runPMAgent([brief], [milestone], [workPackage], [], {
      apiKey: 'sk-test',
      model: 'claude-haiku-3-5',
      fetcher: fetcher as unknown as typeof fetch,
    })

    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string) as { model: string }
    expect(body.model).toBe('claude-haiku-3-5')
  })

  it('handles empty arrays for all inputs gracefully', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    const result = await runPMAgent([], [], [], [], {
      apiKey: 'sk-test',
      fetcher: fetcher as unknown as typeof fetch,
    })

    expect(result.summary).toBeDefined()
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
