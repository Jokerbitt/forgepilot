import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'local-user',
  createDelegationRepository: () => ({ listByStatus: vi.fn().mockResolvedValue([]) }),
}))
vi.mock('@/lib/repositories/projectBriefRepository', () => ({
  createProjectBriefRepository: () => ({ listAll: vi.fn().mockResolvedValue([]) }),
}))
vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: () => ({ listAll: vi.fn().mockResolvedValue([]) }),
}))

describe('GET /api/search', () => {
  it('returns empty results for short query', async () => {
    const req = new NextRequest('http://localhost/api/search?q=a')
    const res = await GET(req)
    const data = await res.json() as { results: unknown[] }
    expect(data.results).toHaveLength(0)
  })

  it('returns search results for valid query', async () => {
    const req = new NextRequest('http://localhost/api/search?q=test')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json() as { query: string; total: number }
    expect(data.query).toBe('test')
    expect(data.total).toBe(0) // empty mock data
  })
})
