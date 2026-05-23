import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(),
}))
vi.mock('@/lib/connectors/registry', () => ({
  getAllConnectorHealth: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/connectors/health', () => {
  it('returns connector health results', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    const { getAllConnectorHealth } = await import('@/lib/connectors/registry')

    vi.mocked(readConnectorConfigs).mockReturnValue({})
    vi.mocked(getAllConnectorHealth).mockResolvedValue([
      { id: 'linear', name: 'Linear', status: 'healthy', latencyMs: 42 },
      { id: 'github', name: 'GitHub', status: 'healthy', latencyMs: 88 },
    ] as unknown as Awaited<ReturnType<typeof getAllConnectorHealth>>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { connectors: unknown[] }

    expect(res.status).toBe(200)
    expect(body.connectors).toHaveLength(2)
  })

  it('returns 500 when registry throws', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    const { getAllConnectorHealth } = await import('@/lib/connectors/registry')

    vi.mocked(readConnectorConfigs).mockReturnValue({})
    vi.mocked(getAllConnectorHealth).mockRejectedValue(new Error('Network timeout'))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { error: string }

    expect(res.status).toBe(500)
    expect(body.error).toBeTruthy()
  })
})
