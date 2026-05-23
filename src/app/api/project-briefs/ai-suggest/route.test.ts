import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/text-generation', () => ({
  generateText: vi.fn(),
  stripJsonCodeFence: vi.fn(),
  AIProviderConfigurationError: class AIProviderConfigurationError extends Error {},
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/project-briefs/ai-suggest', () => {
  it('returns AI-generated brief fields', async () => {
    const { generateText, stripJsonCodeFence } = await import('@/lib/ai/text-generation')

    vi.mocked(generateText).mockResolvedValue({ text: '{"title":"User Auth System","problemStatement":"No login","desiredOutcome":"Users can login","targetAudience":"End users","nonGoals":["No OAuth","No SSO"],"confidence":"high"}', provider: 'mock', model: 'mock-model' } as Awaited<ReturnType<typeof generateText>>)
    vi.mocked(stripJsonCodeFence).mockImplementation((s: string) => s)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ rawIdea: 'I need a user authentication system for my app', scope: 'standard' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { title: string; confidence: string }

    expect(res.status).toBe(200)
    expect(body.title).toBe('User Auth System')
    expect(body.confidence).toBe('high')
  })

  it('returns 400 when rawIdea is too short', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ rawIdea: 'Short', scope: 'standard' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 503 when AI provider not configured', async () => {
    const { generateText, AIProviderConfigurationError } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockRejectedValue(new AIProviderConfigurationError('No API key'))

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ rawIdea: 'I need a user authentication system for my app', scope: 'standard' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(503)
  })
})
