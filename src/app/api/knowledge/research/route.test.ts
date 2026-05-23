import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/knowledge/research-store', () => ({
  readResearchDocuments: vi.fn(),
  upsertResearchDocument: vi.fn(),
  getResearchDocument: vi.fn(),
}))
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(),
}))
vi.mock('@/lib/agent-runner/research-agent', () => ({
  runResearchAgent: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/knowledge/research', () => {
  it('returns all research documents', async () => {
    const { readResearchDocuments } = await import('@/lib/knowledge/research-store')
    vi.mocked(readResearchDocuments).mockReturnValue([
      { id: 'doc-1', topic: 'AI agents', status: 'completed' },
    ] as ReturnType<typeof readResearchDocuments>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { id: string }[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('doc-1')
  })
})

describe('POST /api/knowledge/research', () => {
  it('starts research and returns 202', async () => {
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { upsertResearchDocument } = await import('@/lib/knowledge/research-store')
    const { runResearchAgent } = await import('@/lib/agent-runner/research-agent')

    vi.mocked(readStoredApiKeys).mockReturnValue({ ANTHROPIC_API_KEY: 'sk-test' } as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(upsertResearchDocument).mockReturnValue(undefined)
    vi.mocked(runResearchAgent).mockResolvedValue({ keyFindings: [], sections: [] } as unknown as Awaited<ReturnType<typeof runResearchAgent>>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ topic: 'Quantum computing trends' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as Parameters<typeof POST>[0])
    const body = await res.json() as { id: string; status: string }

    expect(res.status).toBe(202)
    expect(body.status).toBe('running')
    expect(typeof body.id).toBe('string')
  })

  it('returns 422 when ANTHROPIC_API_KEY not configured', async () => {
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ topic: 'Quantum computing' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as Parameters<typeof POST>[0])

    expect(res.status).toBe(422)
  })

  it('returns 400 when topic is missing', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as Parameters<typeof POST>[0])

    expect(res.status).toBe(400)
  })
})
