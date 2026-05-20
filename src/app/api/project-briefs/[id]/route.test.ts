import { describe, it, expect, vi } from 'vitest'
import { GET, PATCH } from './route'

const mockBrief = {
  id: 'abc-123',
  title: 'Test',
  status: 'in_review' as const,
  createdAt: '2026-05-16T00:00:00Z',
  updatedAt: '2026-05-16T00:00:00Z',
  rawIdea: 'A test idea',
  problemStatement: 'A problem',
  targetAudience: 'Developers',
  desiredOutcome: 'A solution',
  constraints: [],
  scope: 'standard' as const,
  researchMode: 'standard' as const,
  privacyMode: 'local' as const,
  requirements: [],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research Brief',
    mode: 'standard' as const,
    privacyMode: 'local' as const,
    preferredExecutor: 'agent' as const,
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
}

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn((id: string) => id === 'abc-123' ? mockBrief : undefined),
  updateProjectBrief: vi.fn((id: string, patch) =>
    id === 'abc-123' ? { ...mockBrief, ...patch } : null
  ),
}))

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/project-briefs/[id]', () => {
  it('returns brief when found', async () => {
    const res = await GET(new Request('http://localhost'), makeParams('abc-123'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('abc-123')
  })

  it('returns 404 when not found', async () => {
    const res = await GET(new Request('http://localhost'), makeParams('not-found'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/project-briefs/[id]', () => {
  it('updates brief when found', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    })
    const res = await PATCH(req, makeParams('abc-123'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('accepted')
  })

  it('returns 404 when not found', async () => {
    const { updateProjectBrief } = await import('@/lib/project-briefs')
    vi.mocked(updateProjectBrief).mockReturnValueOnce(null)
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    })
    const res = await PATCH(req, makeParams('not-found'))
    expect(res.status).toBe(404)
  })
})
