import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(),
  readStoredApiKeys: vi.fn(),
}))
vi.mock('@/lib/connectors/linear-items', () => ({
  fetchLinearWorkItems: vi.fn(),
}))
vi.mock('@/lib/connectors/github-items', () => ({
  fetchGitHubWorkItems: vi.fn(),
}))
vi.mock('@/lib/connectors/sync', () => ({
  readCachedWorkItems: vi.fn(),
}))
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('[]'),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('[]'),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/work-items', () => {
  it('returns merged work items', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    const { fetchLinearWorkItems } = await import('@/lib/connectors/linear-items')
    const { fetchGitHubWorkItems } = await import('@/lib/connectors/github-items')

    vi.mocked(readConnectorConfigs).mockReturnValue({ linear: {}, github: {} } as ReturnType<typeof readConnectorConfigs>)
    vi.mocked(fetchLinearWorkItems).mockResolvedValue([{ id: 'FP-1', title: 'Linear Task', source: 'linear', priority: 2, updatedAt: new Date().toISOString() }] as Awaited<ReturnType<typeof fetchLinearWorkItems>>)
    vi.mocked(fetchGitHubWorkItems).mockResolvedValue([])

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/work-items'))
    const body = await res.json() as { items: unknown[]; total: number }

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('returns cached items when cached=1', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    const { readCachedWorkItems } = await import('@/lib/connectors/sync')

    vi.mocked(readConnectorConfigs).mockReturnValue({} as ReturnType<typeof readConnectorConfigs>)
    vi.mocked(readCachedWorkItems).mockReturnValue({
      items: [{ id: 'cached-1', source: 'linear', priority: 1, updatedAt: new Date().toISOString() }],
      syncedAt: '2024-01-01T00:00:00.000Z',
    } as ReturnType<typeof readCachedWorkItems>)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/work-items?cached=1'))
    const body = await res.json() as { items: unknown[]; fromCache: boolean }

    expect(res.status).toBe(200)
    expect(body.fromCache).toBe(true)
  })

  it('returns error summary when fetchers fail', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    const { fetchLinearWorkItems } = await import('@/lib/connectors/linear-items')
    const { fetchGitHubWorkItems } = await import('@/lib/connectors/github-items')

    vi.mocked(readConnectorConfigs).mockReturnValue({ linear: {}, github: {} } as ReturnType<typeof readConnectorConfigs>)
    vi.mocked(fetchLinearWorkItems).mockRejectedValue(new Error('Linear down'))
    vi.mocked(fetchGitHubWorkItems).mockRejectedValue(new Error('GitHub down'))

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/work-items'))
    const body = await res.json() as { items: unknown[]; errors: string[] }

    expect(res.status).toBe(200)
    expect(body.errors).toHaveLength(2)
    expect(body.items).toHaveLength(0)
  })
})
