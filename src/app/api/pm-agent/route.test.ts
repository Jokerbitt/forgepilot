import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/project-briefs', () => ({ readProjectBriefs: vi.fn() }))
vi.mock('@/lib/knowledge/milestone-store', () => ({ readMilestones: vi.fn(), readWorkPackages: vi.fn() }))
vi.mock('@/lib/connectors/config', () => ({ readStoredApiKeys: vi.fn() }))
vi.mock('@/lib/agent-runner/pm-agent', () => ({ runPMAgent: vi.fn() }))
vi.mock('@/lib/agent-runner/pm-history-store', () => ({ appendPMHistory: vi.fn() }))
vi.mock('@/lib/notifications/notification-store', () => ({ saveNotification: vi.fn() }))
vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(),
  SINGLE_TENANT_USER_ID: 'default',
}))
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue('null'),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
  },
  readFileSync: vi.fn().mockReturnValue('null'),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/pm-agent', () => {
  it('returns last PM plan', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { plan: unknown }

    expect(res.status).toBe(200)
    expect('plan' in body).toBe(true)
  })
})

describe('POST /api/pm-agent', () => {
  it('runs PM agent and returns result', async () => {
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { readProjectBriefs } = await import('@/lib/project-briefs')
    const { readMilestones, readWorkPackages } = await import('@/lib/knowledge/milestone-store')
    const { runPMAgent } = await import('@/lib/agent-runner/pm-agent')
    const { appendPMHistory } = await import('@/lib/agent-runner/pm-history-store')
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')

    vi.mocked(readStoredApiKeys).mockReturnValue({ ANTHROPIC_API_KEY: 'sk-test' } as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(readProjectBriefs).mockReturnValue([])
    vi.mocked(readMilestones).mockReturnValue([])
    vi.mocked(readWorkPackages).mockReturnValue([])
    vi.mocked(createDelegationRepository).mockReturnValue({
      listByStatus: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof createDelegationRepository>)
    vi.mocked(runPMAgent).mockResolvedValue({
      overallHealth: 'green', summary: 'All good', blockers: [], recommendations: [],
    } as unknown as Awaited<ReturnType<typeof runPMAgent>>)
    vi.mocked(appendPMHistory).mockReturnValue(undefined)

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { overallHealth: string }

    expect(res.status).toBe(200)
    expect(body.overallHealth).toBe('green')
  })

  it('returns 422 when ANTHROPIC_API_KEY not configured', async () => {
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const { POST } = await import('./route')
    const res = await POST()

    expect(res.status).toBe(422)
  })
})
