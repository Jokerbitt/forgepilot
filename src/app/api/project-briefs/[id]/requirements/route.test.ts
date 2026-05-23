import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn(),
  updateProjectBrief: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/project-briefs/[id]/requirements', () => {
  it('updates single requirement status', async () => {
    const { findProjectBriefById, updateProjectBrief } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValue({
      id: 'brief-1',
      requirements: [{ id: 'req-1', title: 'Auth', status: 'proposed', type: 'functional', priority: 'must' }],
    } as unknown as ReturnType<typeof findProjectBriefById>)
    vi.mocked(updateProjectBrief).mockReturnValue({
      id: 'brief-1',
      requirements: [{ id: 'req-1', status: 'accepted' }],
    } as unknown as ReturnType<typeof updateProjectBrief>)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ requirementId: 'req-1', status: 'accepted' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(200)
  })

  it('returns 404 when brief not found', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValue(undefined as ReturnType<typeof findProjectBriefById>)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ requirementId: 'req-1', status: 'accepted' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })

  it('bulk-replaces requirements', async () => {
    const { findProjectBriefById, updateProjectBrief } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValue({
      id: 'brief-1', requirements: [],
    } as unknown as ReturnType<typeof findProjectBriefById>)
    vi.mocked(updateProjectBrief).mockReturnValue({
      id: 'brief-1', requirements: [{ id: 'req-2', title: 'Login', status: 'accepted' }],
    } as unknown as ReturnType<typeof updateProjectBrief>)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ requirements: [{ id: 'req-2', title: 'Login', status: 'accepted' }] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(200)
  })
})
