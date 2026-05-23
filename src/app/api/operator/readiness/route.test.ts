import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(),
  readStoredApiKeys: vi.fn(),
}))
vi.mock('@/lib/connectors/registry', () => ({
  getAllConnectorHealth: vi.fn(),
}))
vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(),
}))
vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(),
}))
vi.mock('@/lib/operator/readiness', () => ({
  buildOperatorReadiness: vi.fn(),
  readWorkflowReadiness: vi.fn(),
}))
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue('[]'),
  },
  readFileSync: vi.fn().mockReturnValue('[]'),
}))

const mockFetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GET /api/operator/readiness', () => {
  it('returns readiness summary', async () => {
    const { readConnectorConfigs, readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getAllConnectorHealth } = await import('@/lib/connectors/registry')
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    const { readProjectBriefs } = await import('@/lib/project-briefs')
    const { buildOperatorReadiness, readWorkflowReadiness } = await import('@/lib/operator/readiness')

    vi.mocked(readConnectorConfigs).mockReturnValue({ linear: {}, github: {} } as ReturnType<typeof readConnectorConfigs>)
    vi.mocked(readStoredApiKeys).mockReturnValue({ ANTHROPIC_API_KEY: 'sk-test' } as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(getAllConnectorHealth).mockResolvedValue([])
    vi.mocked(getNBAConfig).mockReturnValue({ aiProvider: 'anthropic', approvalMode: 'autopilot' } as ReturnType<typeof getNBAConfig>)
    vi.mocked(readProjectBriefs).mockReturnValue([])
    vi.mocked(readWorkflowReadiness).mockReturnValue([])
    vi.mocked(buildOperatorReadiness).mockReturnValue({
      overall: 'ready', score: 90, checks: [],
    } as unknown as ReturnType<typeof buildOperatorReadiness>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { overall: string; score: number }

    expect(res.status).toBe(200)
    expect(body.overall).toBe('ready')
    expect(body.score).toBe(90)
  })
})
