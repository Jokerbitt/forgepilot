import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn(),
}))
vi.mock('@/lib/knowledge/research-store', () => ({
  getResearchDocument: vi.fn(),
}))
vi.mock('@/lib/knowledge/milestone-store', () => ({
  persistGeneratedPlan: vi.fn(),
  getMilestonesByBriefId: vi.fn(),
  getWorkPackagesByBriefId: vi.fn(),
}))
vi.mock('@/lib/agent-runner/milestone-generator', () => ({
  generateMilestones: vi.fn(),
}))
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/project-briefs/[id]/generate-milestones', () => {
  it('generates milestones and returns plan', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    const { generateMilestones } = await import('@/lib/agent-runner/milestone-generator')
    const { persistGeneratedPlan } = await import('@/lib/knowledge/milestone-store')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(findProjectBriefById).mockReturnValue({ id: 'brief-1', title: 'Auth' } as unknown as ReturnType<typeof findProjectBriefById>)
    vi.mocked(readStoredApiKeys).mockReturnValue({ ANTHROPIC_API_KEY: 'sk-test' } as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(generateMilestones).mockResolvedValue({
      result: { milestones: [{ id: 'm-1', title: 'M1 Foundation' }], workPackages: [] },
      tokenUsage: { inputTokens: 100, outputTokens: 50 },
    } as unknown as Awaited<ReturnType<typeof generateMilestones>>)
    vi.mocked(persistGeneratedPlan).mockReturnValue({ milestones: [{ id: 'm-1' }], workPackages: [] } as unknown as ReturnType<typeof persistGeneratedPlan>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(200)
  })

  it('returns 404 when brief not found', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValue(undefined as ReturnType<typeof findProjectBriefById>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })

  it('returns 422 when API key not configured', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(findProjectBriefById).mockReturnValue({ id: 'brief-1', title: 'Auth' } as unknown as ReturnType<typeof findProjectBriefById>)
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(422)
  })
})
