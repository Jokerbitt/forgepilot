import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/repositories/projectBriefRepository', () => ({
  createProjectBriefRepository: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/project-briefs/[id]/critic-apply', () => {
  it('applies suggestion and returns updated brief', async () => {
    const { createProjectBriefRepository } = await import('@/lib/repositories/projectBriefRepository')
    vi.mocked(createProjectBriefRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue({
        id: 'brief-1',
        criticReview: {
          suggestions: [{ id: 'sug-1', patch: { title: 'Better title' }, description: 'Improve title' }],
        },
      }),
      update: vi.fn().mockResolvedValue({ id: 'brief-1', title: 'Better title', status: 'accepted' }),
    } as unknown as ReturnType<typeof createProjectBriefRepository>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ suggestionId: 'sug-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(200)
  })

  it('returns 404 when brief not found', async () => {
    const { createProjectBriefRepository } = await import('@/lib/repositories/projectBriefRepository')
    vi.mocked(createProjectBriefRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    } as unknown as ReturnType<typeof createProjectBriefRepository>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ suggestionId: 'sug-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })

  it('returns 422 when no critic review exists', async () => {
    const { createProjectBriefRepository } = await import('@/lib/repositories/projectBriefRepository')
    vi.mocked(createProjectBriefRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue({ id: 'brief-1' }),
      update: vi.fn(),
    } as unknown as ReturnType<typeof createProjectBriefRepository>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ suggestionId: 'sug-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(422)
  })
})
