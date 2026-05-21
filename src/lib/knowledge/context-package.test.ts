import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildContextPackage } from './context-package'
import type { MemoryCard } from '@/lib/knowledge/types'

// Mock the repository factory
vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: vi.fn(),
}))

import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'

function makeCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
  return {
    id: 'card-1',
    type: 'learning',
    title: 'Default Title',
    body: 'Default body content',
    sourceIds: ['delegation-1'],
    projectId: undefined,
    tags: [],
    privacyClass: 'internal',
    confidence: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('buildContextPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty result when no cards exist', async () => {
    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('add pagination endpoint')
    expect(result.cards).toHaveLength(0)
    expect(result.tokenEstimate).toBe(0)
    expect(result.sources).toHaveLength(0)
  })

  it('filters out cards with zero keyword matches', async () => {
    const irrelevant = makeCard({ id: 'c1', title: 'Database schema', body: 'PostgreSQL indexes', tags: [] })
    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([irrelevant]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('frontend button click handler')
    expect(result.cards).toHaveLength(0)
  })

  it('returns matching cards sorted by keyword score descending', async () => {
    const lowScore = makeCard({ id: 'low', title: 'pagination works', body: 'endpoint tested', tags: [] })
    const highScore = makeCard({
      id: 'high',
      title: 'pagination endpoint route',
      body: 'returns paginated results from endpoint',
      tags: ['pagination', 'endpoint'],
    })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([lowScore, highScore]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('add pagination endpoint to the API route')
    expect(result.cards).toHaveLength(2)
    // highScore should be first — it matches more keywords
    expect(result.cards[0].id).toBe('high')
  })

  it('respects maxCards limit', async () => {
    const cards = Array.from({ length: 10 }, (_, i) =>
      makeCard({ id: `c${i}`, title: `pagination result page`, body: `endpoint result ${i}`, tags: [] }),
    )

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue(cards),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('pagination endpoint', { maxCards: 3 })
    expect(result.cards).toHaveLength(3)
  })

  it('defaults to maxCards=4 when not specified', async () => {
    const cards = Array.from({ length: 8 }, (_, i) =>
      makeCard({ id: `c${i}`, title: `pagination route result`, body: `endpoint page ${i}`, tags: [] }),
    )

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue(cards),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('pagination endpoint route')
    expect(result.cards).toHaveLength(4)
  })

  it('calculates tokenEstimate as ceil(charCount / 4) per card', async () => {
    const card = makeCard({ id: 'c1', title: 'test', body: 'endpoint route works', tags: ['endpoint'] })
    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([card]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('endpoint route')
    expect(result.tokenEstimate).toBeGreaterThan(0)
    const text = `${card.title} ${card.body} ${card.tags.join(' ')}`
    expect(result.tokenEstimate).toBe(Math.ceil(text.length / 4))
  })

  it('collects unique sourceIds across all cards', async () => {
    const c1 = makeCard({ id: 'c1', title: 'endpoint route', body: 'result', sourceIds: ['del-1', 'del-2'] })
    const c2 = makeCard({ id: 'c2', title: 'route endpoint', body: 'result', sourceIds: ['del-2', 'del-3'] })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([c1, c2]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('endpoint route')
    expect(result.sources).toEqual(expect.arrayContaining(['del-1', 'del-2', 'del-3']))
    // No duplicates
    expect(result.sources).toHaveLength(3)
  })

  it('returns empty result when repository throws — never throws itself', async () => {
    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('some goal')
    expect(result.cards).toHaveLength(0)
    expect(result.tokenEstimate).toBe(0)
  })
})
