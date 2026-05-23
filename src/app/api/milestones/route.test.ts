import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/knowledge/milestone-store', () => ({
  readMilestones: vi.fn(),
  getWorkPackagesByMilestoneId: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/milestones', () => {
  it('returns all milestones with work packages', async () => {
    const { readMilestones, getWorkPackagesByMilestoneId } = await import('@/lib/knowledge/milestone-store')
    vi.mocked(readMilestones).mockReturnValue([
      { id: 'ms-1', briefId: 'brief-1', title: 'Phase 1', description: '' },
      { id: 'ms-2', briefId: 'brief-2', title: 'Phase 2', description: '' },
    ] as ReturnType<typeof readMilestones>)
    vi.mocked(getWorkPackagesByMilestoneId).mockReturnValue([] as ReturnType<typeof getWorkPackagesByMilestoneId>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/milestones'))
    const body = await res.json() as { id: string }[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].id).toBe('ms-1')
  })

  it('filters milestones by briefId when provided', async () => {
    const { readMilestones, getWorkPackagesByMilestoneId } = await import('@/lib/knowledge/milestone-store')
    vi.mocked(readMilestones).mockReturnValue([
      { id: 'ms-1', briefId: 'brief-1', title: 'Phase 1', description: '' },
      { id: 'ms-2', briefId: 'brief-2', title: 'Phase 2', description: '' },
    ] as ReturnType<typeof readMilestones>)
    vi.mocked(getWorkPackagesByMilestoneId).mockReturnValue([] as ReturnType<typeof getWorkPackagesByMilestoneId>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/milestones?briefId=brief-1'))
    const body = await res.json() as { id: string; briefId: string }[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].briefId).toBe('brief-1')
  })
})
