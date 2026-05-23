import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/context-packages/store', () => ({
  getPackage: vi.fn(),
  deletePackage: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/context-packages/[id]', () => {
  it('returns package when found', async () => {
    const { getPackage } = await import('@/lib/context-packages/store')
    vi.mocked(getPackage).mockReturnValue({ id: 'pkg-1', content: 'context data' } as ReturnType<typeof getPackage>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'pkg-1' }) })
    const body = await res.json() as { id: string }

    expect(res.status).toBe(200)
    expect(body.id).toBe('pkg-1')
  })

  it('returns 404 when package not found', async () => {
    const { getPackage } = await import('@/lib/context-packages/store')
    vi.mocked(getPackage).mockReturnValue(undefined as ReturnType<typeof getPackage>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/context-packages/[id]', () => {
  it('deletes package and returns deleted=true', async () => {
    const { deletePackage } = await import('@/lib/context-packages/store')
    vi.mocked(deletePackage).mockReturnValue(true)

    const { DELETE } = await import('./route')
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'pkg-1' }) })
    const body = await res.json() as { deleted: boolean }

    expect(res.status).toBe(200)
    expect(body.deleted).toBe(true)
  })
})
