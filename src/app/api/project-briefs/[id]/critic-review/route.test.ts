import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/repositories/projectBriefRepository', () => ({
  createProjectBriefRepository: vi.fn(),
}))
vi.mock('@/lib/brief-critic', () => ({
  reviewBrief: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/project-briefs/[id]/critic-review', () => {
  it('runs critic review and returns result', async () => {
    const { createProjectBriefRepository } = await import('@/lib/repositories/projectBriefRepository')
    const { reviewBrief } = await import('@/lib/brief-critic')

    vi.mocked(reviewBrief).mockResolvedValue({
      verdict: 'approved',
      issues: [],
      strengths: ['Clear target'],
      suggestions: [],
      reviewedAt: '2024-01-01T00:00:00.000Z',
    })
    vi.mocked(createProjectBriefRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue({ id: 'brief-1', title: 'Auth module' }),
      update: vi.fn().mockResolvedValue({ id: 'brief-1', criticReview: { verdict: 'approved', suggestions: [] } }),
    } as unknown as ReturnType<typeof createProjectBriefRepository>)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'brief-1' }) })
    const body = await res.json() as { review: { verdict: string } }

    expect(res.status).toBe(200)
    expect(body.review.verdict).toBe('approved')
  })

  it('returns 404 when brief not found', async () => {
    const { createProjectBriefRepository } = await import('@/lib/repositories/projectBriefRepository')
    vi.mocked(createProjectBriefRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    } as unknown as ReturnType<typeof createProjectBriefRepository>)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })
})
