import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'

const mockGet = vi.fn()
const mockUpsert = vi.fn()
const mockKeys = vi.fn()
const mockRun = vi.fn()

vi.mock('@/lib/knowledge/research-store', () => ({
  getResearchDocument: (...a: unknown[]) => mockGet(...a),
  upsertResearchDocument: (...a: unknown[]) => mockUpsert(...a),
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: () => mockKeys(),
}))

vi.mock('@/lib/agent-runner/research-agent', () => ({
  runResearchAgent: (...a: unknown[]) => mockRun(...a),
}))

const baseDoc = {
  id: 'test-id',
  topic: 'Test Topic',
  status: 'failed' as const,
  keyFindings: [],
  sections: [],
  citations: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function makeReq() {
  return new Request('http://localhost/api/knowledge/research/test-id/rerun', { method: 'POST' })
}

describe('POST /api/knowledge/research/[id]/rerun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRun.mockResolvedValue({
      abstract: 'Abstract',
      keyFindings: ['Finding'],
      sections: [],
      citations: [],
      tags: ['tag'],
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    })
  })

  it('returns 404 for unknown id', async () => {
    mockGet.mockReturnValue(undefined)
    const res = await POST(makeReq(), { params: { id: 'unknown' } })
    expect(res.status).toBe(404)
  })

  it('returns 409 if already running', async () => {
    mockGet.mockReturnValue({ ...baseDoc, status: 'running' })
    mockKeys.mockReturnValue({ ANTHROPIC_API_KEY: 'key' })
    const res = await POST(makeReq(), { params: { id: 'test-id' } })
    expect(res.status).toBe(409)
  })

  it('returns 422 if no API key', async () => {
    mockGet.mockReturnValue(baseDoc)
    mockKeys.mockReturnValue({})
    const res = await POST(makeReq(), { params: { id: 'test-id' } })
    expect(res.status).toBe(422)
  })

  it('resets document to running and returns 202', async () => {
    mockGet.mockReturnValue(baseDoc)
    mockKeys.mockReturnValue({ ANTHROPIC_API_KEY: 'key' })
    const res = await POST(makeReq(), { params: { id: 'test-id' } })
    expect(res.status).toBe(202)
    const body = await res.json() as { id: string; status: string }
    expect(body.status).toBe('running')
    expect(body.id).toBe('test-id')
  })

  it('clears abstract and findings on rerun', async () => {
    const docWithData = {
      ...baseDoc,
      status: 'failed' as const,
      abstract: 'Old abstract',
      keyFindings: ['Old finding'],
      citations: [{ id: 'c1', title: 'old', url: 'u', credibility: 'general' as const, excerpt: 'x' }],
    }
    mockGet.mockReturnValue(docWithData)
    mockKeys.mockReturnValue({ ANTHROPIC_API_KEY: 'key' })
    await POST(makeReq(), { params: { id: 'test-id' } })
    const upserted = mockUpsert.mock.calls[0][0] as typeof docWithData
    expect(upserted.keyFindings).toHaveLength(0)
    expect(upserted.citations).toHaveLength(0)
    expect(upserted.abstract).toBeUndefined()
  })
})
