import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/knowledge/research-store', () => ({
  getResearchDocument: vi.fn(),
  readResearchDocuments: vi.fn(),
  upsertResearchDocument: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/knowledge/research/[id]', () => {
  it('returns document when found', async () => {
    const { getResearchDocument } = await import('@/lib/knowledge/research-store')
    vi.mocked(getResearchDocument).mockReturnValue({ id: 'doc-1', topic: 'AI agents', status: 'completed' } as ReturnType<typeof getResearchDocument>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'doc-1' }) })
    const body = await res.json() as { id: string; topic: string }

    expect(res.status).toBe(200)
    expect(body.id).toBe('doc-1')
    expect(body.topic).toBe('AI agents')
  })

  it('returns 404 when document not found', async () => {
    const { getResearchDocument } = await import('@/lib/knowledge/research-store')
    vi.mocked(getResearchDocument).mockReturnValue(undefined as ReturnType<typeof getResearchDocument>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })
})
