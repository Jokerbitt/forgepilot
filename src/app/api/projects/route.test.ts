import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(),
}))
vi.mock('@/lib/pilot/idea-history-store', () => ({
  readIdeaHistory: vi.fn(),
}))
vi.mock('@/lib/agents/orchestrated-run', () => ({
  getRun: vi.fn(),
  reapStaleRuns: vi.fn(),
}))
vi.mock('@/lib/delegations/queue', () => ({
  readDelegations: vi.fn(),
}))
vi.mock('@/lib/knowledge/milestone-store', () => ({
  getMilestonesByBriefId: vi.fn(),
  getWorkPackagesByBriefId: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/projects', () => {
  it('returns empty array when no project briefs', async () => {
    const { readProjectBriefs } = await import('@/lib/project-briefs')
    const { readIdeaHistory } = await import('@/lib/pilot/idea-history-store')
    const { readDelegations } = await import('@/lib/delegations/queue')
    const { getMilestonesByBriefId, getWorkPackagesByBriefId } = await import('@/lib/knowledge/milestone-store')

    vi.mocked(readProjectBriefs).mockReturnValue([])
    vi.mocked(readIdeaHistory).mockReturnValue([])
    vi.mocked(readDelegations).mockReturnValue([])
    vi.mocked(getMilestonesByBriefId).mockReturnValue([])
    vi.mocked(getWorkPackagesByBriefId).mockReturnValue([])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as unknown[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(0)
  })

  it('returns project summaries with planning metrics', async () => {
    const { readProjectBriefs } = await import('@/lib/project-briefs')
    const { readIdeaHistory } = await import('@/lib/pilot/idea-history-store')
    const { readDelegations } = await import('@/lib/delegations/queue')
    const { getMilestonesByBriefId, getWorkPackagesByBriefId } = await import('@/lib/knowledge/milestone-store')

    vi.mocked(readProjectBriefs).mockReturnValue([{
      id: 'brief-1', title: 'Auth Module', problemStatement: 'No auth',
      createdAt: '2024-01-01T00:00:00.000Z',
    }] as ReturnType<typeof readProjectBriefs>)
    vi.mocked(readIdeaHistory).mockReturnValue([])
    vi.mocked(readDelegations).mockReturnValue([])
    vi.mocked(getMilestonesByBriefId).mockReturnValue([])
    vi.mocked(getWorkPackagesByBriefId).mockReturnValue([])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as Array<{ id: string; title: string; status: string; metrics: unknown; progress: unknown; pmPlan: unknown; planningMode: string; targetPlatform: string; persistenceStrategy: string }>

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('brief-1')
    expect(body[0].title).toBe('Auth Module')
    expect(body[0].status).toBeDefined()
    expect(body[0].metrics).toBeDefined()
    expect(body[0].progress).toBeDefined()
    expect(body[0].pmPlan).toBeDefined()
    expect(body[0].planningMode).toBe('beginner')
    expect(body[0].targetPlatform).toBe('webapp')
    expect(body[0].persistenceStrategy).toBe('postgres')
  })
})
