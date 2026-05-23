import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agent-runner/pm-history-store', () => ({
  readPMHistory: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/pm-agent/history', () => {
  it('returns up to default 5 entries', async () => {
    const { readPMHistory } = await import('@/lib/agent-runner/pm-history-store')
    vi.mocked(readPMHistory).mockReturnValue(
      Array.from({ length: 8 }, (_, i) => ({ id: `entry-${i}`, plan: 'some plan' })) as unknown as ReturnType<typeof readPMHistory>,
    )

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/pm-agent/history'))
    const body = await res.json() as unknown[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(5)
  })

  it('respects limit query param', async () => {
    const { readPMHistory } = await import('@/lib/agent-runner/pm-history-store')
    vi.mocked(readPMHistory).mockReturnValue(
      Array.from({ length: 8 }, (_, i) => ({ id: `entry-${i}` })) as unknown as ReturnType<typeof readPMHistory>,
    )

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/pm-agent/history?limit=3'))
    const body = await res.json() as unknown[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(3)
  })

  it('returns empty array when no history', async () => {
    const { readPMHistory } = await import('@/lib/agent-runner/pm-history-store')
    vi.mocked(readPMHistory).mockReturnValue([] as ReturnType<typeof readPMHistory>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/pm-agent/history'))
    const body = await res.json() as unknown[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(0)
  })
})
