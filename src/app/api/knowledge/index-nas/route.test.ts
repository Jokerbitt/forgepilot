import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/knowledge/nas-indexer', () => ({
  indexNasFiles: vi.fn(),
  getIndexStatus: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/knowledge/index-nas', () => {
  it('returns index status', async () => {
    const { getIndexStatus } = await import('@/lib/knowledge/nas-indexer')
    vi.mocked(getIndexStatus).mockReturnValue({
      sourcesTotal: 42,
      staleSources: 0,
      lastIndexedAt: '2024-01-01T00:00:00.000Z',
      nasReachable: true,
      secondbrainReachable: true,
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { sourcesTotal: number }

    expect(res.status).toBe(200)
    expect(body.sourcesTotal).toBe(42)
  })

  it('returns 500 when getIndexStatus throws', async () => {
    const { getIndexStatus } = await import('@/lib/knowledge/nas-indexer')
    vi.mocked(getIndexStatus).mockImplementation(() => { throw new Error('NAS unreachable') })

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(500)
  })
})

describe('POST /api/knowledge/index-nas', () => {
  it('triggers indexing and returns result', async () => {
    const { indexNasFiles } = await import('@/lib/knowledge/nas-indexer')
    vi.mocked(indexNasFiles).mockResolvedValue({
      sourcesIndexed: 2,
      itemsIndexed: 10,
      cardsCreated: 5,
      skipped: 0,
      sensitiveSkipped: 0,
      errors: [],
    })

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { itemsIndexed: number }

    expect(res.status).toBe(200)
    expect(body.itemsIndexed).toBe(10)
  })

  it('returns 500 when indexing throws', async () => {
    const { indexNasFiles } = await import('@/lib/knowledge/nas-indexer')
    vi.mocked(indexNasFiles).mockRejectedValue(new Error('NAS unreachable'))

    const { POST } = await import('./route')
    const res = await POST()

    expect(res.status).toBe(500)
  })
})
