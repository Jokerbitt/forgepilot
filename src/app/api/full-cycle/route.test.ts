import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the route
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(),
}))
vi.mock('@/lib/knowledge/research-store', () => ({
  upsertResearchDocument: vi.fn(),
  getResearchDocument: vi.fn(),
}))
vi.mock('@/lib/agent-runner/research-agent', () => ({
  runResearchAgent: vi.fn(),
}))
vi.mock('@/lib/project-briefs', () => ({
  saveProjectBrief: vi.fn(),
  findProjectBriefById: vi.fn(),
  updateProjectBrief: vi.fn(),
  readProjectBriefs: vi.fn(),
}))
vi.mock('@/lib/ai/text-generation', () => ({
  generateText: vi.fn(),
  stripJsonCodeFence: vi.fn((s: string) => s),
  AIProviderConfigurationError: class AIProviderConfigurationError extends Error {},
}))
vi.mock('@/lib/agent-runner/milestone-generator', () => ({
  generateMilestones: vi.fn(),
}))
vi.mock('@/lib/knowledge/milestone-store', () => ({
  persistGeneratedPlan: vi.fn(),
  readMilestones: vi.fn(() => []),
  readWorkPackages: vi.fn(() => []),
}))
vi.mock('@/lib/agent-runner/pm-agent', () => ({
  runPMAgent: vi.fn(),
}))
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => '[]'),
  },
}))

import { POST } from './route'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { upsertResearchDocument, getResearchDocument } from '@/lib/knowledge/research-store'
import { runResearchAgent } from '@/lib/agent-runner/research-agent'
import { saveProjectBrief, findProjectBriefById, updateProjectBrief, readProjectBriefs } from '@/lib/project-briefs'
import { generateText } from '@/lib/ai/text-generation'
import { generateMilestones } from '@/lib/agent-runner/milestone-generator'
import { runPMAgent } from '@/lib/agent-runner/pm-agent'

const mockReadStoredApiKeys = vi.mocked(readStoredApiKeys)
const mockRunResearchAgent = vi.mocked(runResearchAgent)
const mockGetResearchDocument = vi.mocked(getResearchDocument)
const mockGenerateText = vi.mocked(generateText)
const mockSaveProjectBrief = vi.mocked(saveProjectBrief)
const mockFindProjectBriefById = vi.mocked(findProjectBriefById)
const mockUpdateProjectBrief = vi.mocked(updateProjectBrief)
const mockReadProjectBriefs = vi.mocked(readProjectBriefs)
const mockGenerateMilestones = vi.mocked(generateMilestones)
const mockRunPMAgent = vi.mocked(runPMAgent)

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/full-cycle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function collectSSELines(response: Response): Promise<string[]> {
  const text = await response.text()
  return text
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => line.slice(6))
}

describe('POST /api/full-cycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadStoredApiKeys.mockReturnValue({ ANTHROPIC_API_KEY: 'test-key' })
    vi.mocked(upsertResearchDocument).mockImplementation(() => undefined)
    vi.mocked(saveProjectBrief).mockImplementation(b => b)
    mockReadProjectBriefs.mockReturnValue([])
  })

  it('returns 400 when topic is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('topic is required')
  })

  it('returns 400 when topic is empty string', async () => {
    const res = await POST(makeRequest({ topic: '   ' }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('topic is required')
  })

  it('sets SSE headers on successful stream start', async () => {
    // Setup mocks to short-circuit after step 1 failure
    mockRunResearchAgent.mockRejectedValue(new Error('Research API down'))

    const res = await POST(makeRequest({ topic: 'Test Topic' }))

    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
    expect(res.headers.get('Connection')).toBe('keep-alive')
  })

  it('propagates step 1 failure in SSE stream', async () => {
    mockRunResearchAgent.mockRejectedValue(new Error('API timeout'))

    const res = await POST(makeRequest({ topic: 'Test Topic' }))
    const lines = await collectSSELines(res)

    const events = lines.map(l => JSON.parse(l) as Record<string, unknown>)

    // First event: step 1 running
    expect(events[0]).toMatchObject({ step: 1, status: 'running' })

    // Last event: error on step 1
    const errorEvent = events.find(e => 'error' in e)
    expect(errorEvent).toBeDefined()
    expect(errorEvent?.step).toBe(1)
    expect(typeof errorEvent?.error).toBe('string')
    expect((errorEvent?.error as string)).toContain('API timeout')
  })

  it('returns 422 when ANTHROPIC_API_KEY is not configured', async () => {
    mockReadStoredApiKeys.mockReturnValue({})

    const res = await POST(makeRequest({ topic: 'Some topic' }))
    expect(res.status).toBe(422)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('ANTHROPIC_API_KEY')
  })

  it('streams all 5 steps and done event on happy path', async () => {
    const fakeResearch = {
      id: 'test-research-id',
      topic: 'Test Topic',
      status: 'completed' as const,
      keyFindings: ['Finding 1', 'Finding 2'],
      sections: [],
      citations: [],
      tags: ['test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: 'claude-opus-4-7',
      abstract: 'Test abstract',
    }

    mockRunResearchAgent.mockResolvedValue({
      abstract: 'Test abstract',
      keyFindings: ['Finding 1', 'Finding 2'],
      sections: [],
      citations: [],
      tags: ['test'],
    })

    mockGetResearchDocument.mockReturnValue(fakeResearch)

    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        title: 'Test Brief',
        problemStatement: 'A problem',
        desiredOutcome: 'An outcome',
        targetAudience: 'Developers',
        constraints: [],
        nonGoals: [],
      }),
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 100,
      outputTokens: 200,
    })

    const fakeBrief = {
      id: 'test-brief-id',
      title: 'Test Brief',
      status: 'accepted' as const,
      rawIdea: 'test',
      problemStatement: 'A problem',
      desiredOutcome: 'An outcome',
      targetAudience: 'Developers',
      constraints: [],
      nonGoals: [],
      scope: 'standard' as const,
      researchMode: 'standard' as const,
      privacyMode: 'local' as const,
      requirements: [],
      useCases: [],
      risks: [],
      researchRunIds: [],
      researchBriefDraft: {
        title: 'Research Brief: Test Brief',
        mode: 'standard' as const,
        privacyMode: 'local' as const,
        preferredExecutor: 'agent' as const,
        researchQuestions: [],
        searchTerms: [],
        preferredSourceTypes: ['web' as const],
        excludeCriteria: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    mockSaveProjectBrief.mockReturnValue(fakeBrief)
    mockUpdateProjectBrief.mockReturnValue({ ...fakeBrief, status: 'accepted' })
    mockFindProjectBriefById.mockReturnValue(fakeBrief)

    mockGenerateMilestones.mockResolvedValue({
      result: { milestones: [], workPackages: [] },
      tokenUsage: { promptTokens: 100, completionTokens: 200 },
    })

    mockRunPMAgent.mockResolvedValue({
      summary: 'All good',
      overallHealth: 'green',
      reviews: [],
      nextDelegations: [],
      blockers: [],
      recommendations: [],
      runAt: new Date().toISOString(),
      tokenUsage: { promptTokens: 50, completionTokens: 50 },
    })

    const res = await POST(makeRequest({ topic: 'Test Topic' }))
    const lines = await collectSSELines(res)
    const events = lines.map(l => JSON.parse(l) as Record<string, unknown>)

    // Should have running + done for each step + final done
    const stepNumbers = events.filter(e => 'step' in e).map(e => e.step)
    expect(stepNumbers).toContain(1)
    expect(stepNumbers).toContain(2)
    expect(stepNumbers).toContain(3)
    expect(stepNumbers).toContain(4)
    expect(stepNumbers).toContain(5)

    const doneEvent = events.find(e => e.done === true)
    expect(doneEvent).toBeDefined()
    expect(doneEvent?.briefId).toBeDefined()
    expect(doneEvent?.researchId).toBeDefined()
  })
})
