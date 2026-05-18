import { describe, it, expect, vi } from 'vitest'
import { computeResearchStats } from './route'

const mockRead = vi.fn()

vi.mock('@/lib/knowledge/research-store', () => ({
  readResearchDocuments: () => mockRead(),
}))

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'id1',
  topic: 'Test',
  status: 'completed' as const,
  keyFindings: [],
  sections: [],
  citations: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('computeResearchStats', () => {
  it('returns zeros for empty list', () => {
    mockRead.mockReturnValue([])
    const stats = computeResearchStats()
    expect(stats.total).toBe(0)
    expect(stats.totalCitations).toBe(0)
    expect(stats.academicRatio).toBe(0)
  })

  it('counts docs by status', () => {
    mockRead.mockReturnValue([
      makeDoc({ status: 'completed' }),
      makeDoc({ id: 'id2', status: 'running' }),
      makeDoc({ id: 'id3', status: 'failed' }),
    ])
    const stats = computeResearchStats()
    expect(stats.total).toBe(3)
    expect(stats.completed).toBe(1)
    expect(stats.running).toBe(1)
    expect(stats.failed).toBe(1)
  })

  it('computes academic ratio correctly', () => {
    mockRead.mockReturnValue([makeDoc({
      citations: [
        { id: 'c1', credibility: 'academic', title: 'T', url: 'u', excerpt: 'e' },
        { id: 'c2', credibility: 'academic', title: 'T', url: 'u', excerpt: 'e' },
        { id: 'c3', credibility: 'general',  title: 'T', url: 'u', excerpt: 'e' },
        { id: 'c4', credibility: 'general',  title: 'T', url: 'u', excerpt: 'e' },
      ],
    })])
    const stats = computeResearchStats()
    expect(stats.academicRatio).toBe(0.5)
    expect(stats.academicCitations).toBe(2)
    expect(stats.totalCitations).toBe(4)
  })

  it('accumulates token usage', () => {
    mockRead.mockReturnValue([
      makeDoc({ tokenUsage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 } }),
      makeDoc({ id: 'id2', tokenUsage: { promptTokens: 2000, completionTokens: 1000, totalTokens: 3000 } }),
    ])
    const stats = computeResearchStats()
    expect(stats.totalTokens).toBe(4500)
  })

  it('returns top tags sorted by frequency', () => {
    mockRead.mockReturnValue([
      makeDoc({ tags: ['ai', 'ml', 'research'] }),
      makeDoc({ id: 'id2', tags: ['ai', 'ml'] }),
      makeDoc({ id: 'id3', tags: ['ai'] }),
    ])
    const stats = computeResearchStats()
    expect(stats.topTags[0].tag).toBe('ai')
    expect(stats.topTags[0].count).toBe(3)
    expect(stats.topTags[1].tag).toBe('ml')
    expect(stats.topTags[1].count).toBe(2)
  })
})
