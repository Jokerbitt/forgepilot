import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/ai/ollama-workloads', () => ({
  embed: vi.fn(),
  classify: vi.fn(),
  summarize: vi.fn(),
  compressContext: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/ai/workloads', () => {
  it('returns embedding result for embed workload', async () => {
    const { embed } = await import('@/lib/ai/ollama-workloads')
    vi.mocked(embed).mockResolvedValue({ embedding: [0.1, 0.2, 0.3], model: 'nomic-embed-text' })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/workloads', {
      method: 'POST',
      body: JSON.stringify({ workload: 'embed', text: 'Hello world' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { embedding: number[] }

    expect(res.status).toBe(200)
    expect(body.embedding).toHaveLength(3)
  })

  it('returns summary for summarize workload', async () => {
    const { summarize } = await import('@/lib/ai/ollama-workloads')
    vi.mocked(summarize).mockResolvedValue({ summary: 'Short summary.', sentences: 1 })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/workloads', {
      method: 'POST',
      body: JSON.stringify({ workload: 'summarize', text: 'Long text here...', maxSentences: 2 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { summary: string }

    expect(res.status).toBe(200)
    expect(body.summary).toBeTruthy()
  })

  it('returns 400 when labels missing for classify', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/workloads', {
      method: 'POST',
      body: JSON.stringify({ workload: 'classify', text: 'Some text' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when workload is invalid', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/workloads', {
      method: 'POST',
      body: JSON.stringify({ workload: 'unknown', text: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
