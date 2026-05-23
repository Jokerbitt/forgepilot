import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn(),
  updateProjectBrief: vi.fn(),
}))
vi.mock('@/lib/ai/text-generation', () => ({
  generateText: vi.fn(),
  stripJsonCodeFence: vi.fn(),
  AIProviderConfigurationError: class AIProviderConfigurationError extends Error {},
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/project-briefs/[id]/generate-requirements', () => {
  it('generates and saves requirements', async () => {
    const { findProjectBriefById, updateProjectBrief } = await import('@/lib/project-briefs')
    const { generateText, stripJsonCodeFence } = await import('@/lib/ai/text-generation')

    vi.mocked(findProjectBriefById).mockReturnValue({
      id: 'brief-1', title: 'Auth', problemStatement: 'No auth', desiredOutcome: 'Login',
      targetAudience: 'Users', scope: 'standard', constraints: [], nonGoals: [],
      requirements: [], useCases: [], risks: [],
    } as unknown as ReturnType<typeof findProjectBriefById>)
    vi.mocked(generateText).mockResolvedValue({
      text: '{"requirements":[{"id":"req-1","title":"User can login","type":"functional","priority":"must","status":"proposed"}],"useCases":[],"risks":[]}',
      provider: 'mock',
      model: 'mock-model',
    })
    vi.mocked(stripJsonCodeFence).mockImplementation((s: string) => s)
    vi.mocked(updateProjectBrief).mockReturnValue({ id: 'brief-1', requirements: [{ id: 'req-1' }] } as unknown as ReturnType<typeof updateProjectBrief>)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(200)
  })

  it('returns 404 when brief not found', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValue(undefined as ReturnType<typeof findProjectBriefById>)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })
})
