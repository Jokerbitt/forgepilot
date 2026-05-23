import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn(),
  buildResearchBriefFromProjectBrief: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/project-briefs/[id]/research-brief', () => {
  it('returns research brief for existing project', async () => {
    const { findProjectBriefById, buildResearchBriefFromProjectBrief } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValue({ id: 'brief-1', title: 'Auth' } as unknown as ReturnType<typeof findProjectBriefById>)
    vi.mocked(buildResearchBriefFromProjectBrief).mockReturnValue({ topic: 'Auth module research', questions: [] } as unknown as ReturnType<typeof buildResearchBriefFromProjectBrief>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'brief-1' }) })
    const body = await res.json() as { topic: string }

    expect(res.status).toBe(200)
    expect(body.topic).toBe('Auth module research')
  })

  it('returns 404 when brief not found', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValue(undefined as ReturnType<typeof findProjectBriefById>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })
})
