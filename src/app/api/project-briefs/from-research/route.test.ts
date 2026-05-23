import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/knowledge/research-store', () => ({
  getResearchDocument: vi.fn(),
}))
vi.mock('@/lib/project-briefs', () => ({
  saveProjectBrief: vi.fn(),
  buildProjectBrief: vi.fn(),
}))
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(),
}))
vi.mock('@/lib/ai/text-generation', () => ({
  generateText: vi.fn(),
  stripJsonCodeFence: vi.fn(),
  AIProviderConfigurationError: class AIProviderConfigurationError extends Error {},
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/project-briefs/from-research', () => {
  it('creates brief from completed research', async () => {
    const { getResearchDocument } = await import('@/lib/knowledge/research-store')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { generateText, stripJsonCodeFence } = await import('@/lib/ai/text-generation')
    const { saveProjectBrief, buildProjectBrief } = await import('@/lib/project-briefs')

    vi.mocked(getResearchDocument).mockReturnValue({
      id: 'doc-1', topic: 'AI Agents', status: 'completed',
      keyFindings: ['Finding 1'], sections: [],
      citations: [{
        id: 'cit-1',
        title: 'Agent research',
        url: 'https://example.com/agent-research',
        credibility: 'reputable',
        excerpt: 'Useful agent orchestration pattern.',
      }],
      tags: ['ai', 'agents'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as unknown as ReturnType<typeof getResearchDocument>)
    vi.mocked(readStoredApiKeys).mockReturnValue({ ANTHROPIC_API_KEY: 'sk-test' } as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(generateText).mockResolvedValue({ text: '{"title":"AI Agent Platform","problemStatement":"Need agents","desiredOutcome":"Working agents","targetAudience":"Developers","constraints":[],"nonGoals":[]}', provider: 'mock', model: 'mock-model' } as Awaited<ReturnType<typeof generateText>>)
    vi.mocked(stripJsonCodeFence).mockImplementation((s: string) => s)
    vi.mocked(buildProjectBrief).mockReturnValue({ id: 'brief-new', title: 'AI Agent Platform' } as unknown as ReturnType<typeof buildProjectBrief>)
    vi.mocked(saveProjectBrief).mockReturnValue({ id: 'brief-new', title: 'AI Agent Platform' } as unknown as ReturnType<typeof saveProjectBrief>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ researchId: 'doc-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { id: string }

    expect(res.status).toBe(200)
    const briefId = (body as unknown as { briefId: string }).briefId
    expect(typeof briefId).toBe('string')
    expect(briefId.length).toBeGreaterThan(0)
  })

  it('returns 404 when research document not found', async () => {
    const { getResearchDocument } = await import('@/lib/knowledge/research-store')
    vi.mocked(getResearchDocument).mockReturnValue(undefined as ReturnType<typeof getResearchDocument>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ researchId: 'missing' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(404)
  })

  it('returns 422 when research not completed', async () => {
    const { getResearchDocument } = await import('@/lib/knowledge/research-store')
    vi.mocked(getResearchDocument).mockReturnValue({
      id: 'doc-1', topic: 'AI', status: 'running',
      keyFindings: [],
      sections: [],
      citations: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as unknown as ReturnType<typeof getResearchDocument>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ researchId: 'doc-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(422)
  })

  it('returns 400 when researchId is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
