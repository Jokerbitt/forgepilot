import { describe, it, expect, vi } from 'vitest'
import { generateMilestones } from './milestone-generator'
import type { ProjectBrief } from '@/lib/models/project-brief'

const baseBrief: ProjectBrief = {
  id: 'brief-1',
  title: 'ForgePilot Test Project',
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  rawIdea: 'Build an AI workflow OS',
  problemStatement: 'Developers waste time on repetitive tasks',
  targetAudience: 'Indie developers and small teams',
  desiredOutcome: 'Automated AI delegation pipeline',
  constraints: ['no external APIs without approval'],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
  requirements: [
    {
      id: 'req-1',
      briefId: 'brief-1',
      type: 'functional',
      title: 'Project intake',
      description: 'Accept project ideas via n8n',
      priority: 'must',
      source: 'user_input',
      findingIds: [],
      status: 'accepted',
    },
  ],
  useCases: [],
  nonGoals: ['mobile app'],
  risks: [{ id: 'risk-1', briefId: 'brief-1', title: 'Scope creep', description: 'Features grow unchecked', probability: 'medium', impact: 'high', isOpenAssumption: false, findingIds: [] }],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research brief',
    mode: 'standard',
    privacyMode: 'local',
    preferredExecutor: 'agent',
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
}

const validPayload = {
  milestones: [
    { title: 'Setup', description: 'Initial setup', goal: 'Repo initialized', targetWeek: 1, status: 'planned' },
    { title: 'Core', description: 'Core engine', goal: 'Delegations working', targetWeek: 3, status: 'planned' },
  ],
  workPackages: [
    {
      milestoneIndex: 0,
      title: 'Init repo',
      description: 'Create Next.js project',
      definitionOfDone: ['Repo created', 'CI green'],
      riskClass: 'A',
      priority: 'high',
      estimatedHours: 4,
      dependsOn: [],
      status: 'backlog',
      tags: ['setup'],
    },
  ],
}

function makeApiResponse(content: string, status = 200) {
  return new Response(
    JSON.stringify({
      id: 'msg-1',
      content: [{ type: 'text', text: content }],
      usage: { input_tokens: 150, output_tokens: 300 },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('generateMilestones', () => {
  it('parses a valid JSON response into MilestoneGenerationResult', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    const { result, tokenUsage } = await generateMilestones(baseBrief, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch })

    expect(result.milestones).toHaveLength(2)
    expect(result.milestones[0].title).toBe('Setup')
    expect(result.workPackages).toHaveLength(1)
    expect(result.workPackages[0].title).toBe('Init repo')
    expect(tokenUsage.promptTokens).toBe(150)
    expect(tokenUsage.completionTokens).toBe(300)
  })

  it('strips markdown fences before parsing JSON', async () => {
    const wrapped = '```json\n' + JSON.stringify(validPayload) + '\n```'
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(wrapped))

    const { result } = await generateMilestones(baseBrief, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch })

    expect(result.milestones[0].title).toBe('Setup')
    expect(result.workPackages[0].riskClass).toBe('A')
  })

  it('throws when response body is not valid JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse('Not JSON at all, sorry'))

    await expect(
      generateMilestones(baseBrief, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow('Could not parse milestone generation response as JSON')
  })

  it('throws on non-200 API response with status code in message', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    )

    await expect(
      generateMilestones(baseBrief, { apiKey: 'bad-key', fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow('Anthropic API 401')
  })

  it('sends request to Anthropic messages endpoint with correct headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await generateMilestones(baseBrief, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch })

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'sk-test' }),
      }),
    )
  })

  it('defaults to claude-sonnet-4-6 model', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await generateMilestones(baseBrief, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch })

    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string) as { model: string }
    expect(body.model).toBe('claude-sonnet-4-6')
  })

  it('uses custom model when provided in options', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await generateMilestones(baseBrief, { apiKey: 'sk-test', model: 'claude-opus-4-7', fetcher: fetcher as unknown as typeof fetch })

    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string) as { model: string }
    expect(body.model).toBe('claude-opus-4-7')
  })

  it('includes research context in prompt when ResearchDocument is provided', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await generateMilestones(
      baseBrief,
      { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch },
      {
        id: 'res-1',
        topic: 'AI workflows',
        status: 'completed',
        keyFindings: ['Finding A', 'Finding B'],
        sections: [],
        citations: [],
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    )

    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string) as { messages: Array<{ content: string }> }
    expect(body.messages[0].content).toContain('Finding A')
  })

  it('throws on 500 server error', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )

    await expect(
      generateMilestones(baseBrief, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow('Anthropic API 500')
  })
})
