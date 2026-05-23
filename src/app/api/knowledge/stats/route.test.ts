import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryCard, KnowledgeSource } from '@/lib/knowledge/types'

vi.mock('@/lib/knowledge/store', () => ({
  getCards: vi.fn(),
  getSources: vi.fn(),
}))

vi.mock('@/lib/knowledge/knowledge-card', () => ({
  readKnowledgeCards: vi.fn(() => []),
}))

vi.mock('@/lib/knowledge/nas-indexer', () => ({
  getIndexStatus: vi.fn(() => ({
    sourcesTotal: 0,
    staleSources: 0,
    lastIndexedAt: null,
    nasReachable: false,
    secondbrainReachable: false,
  })),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'sven',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: vi.fn(async () => []),
  })),
}))

import { GET } from './route'
import { getCards, getSources } from '@/lib/knowledge/store'
import { getIndexStatus } from '@/lib/knowledge/nas-indexer'
import { readKnowledgeCards } from '@/lib/knowledge/knowledge-card'

const mockGetCards = vi.mocked(getCards)
const mockGetSources = vi.mocked(getSources)
const mockGetIndexStatus = vi.mocked(getIndexStatus)
const mockReadKnowledgeCards = vi.mocked(readKnowledgeCards)

function makeCard(type: MemoryCard['type'], n: number): MemoryCard {
  return {
    id: `card-${n}`,
    type,
    title: `Card ${n}`,
    body: 'body',
    sourceIds: [],
    tags: [],
    privacyClass: 'internal',
    confidence: 'medium',
    createdAt: '2026-05-22T04:00:00.000Z',
    updatedAt: '2026-05-22T04:00:00.000Z',
  }
}

function makeNasSource(n: number, lastFetched: string): KnowledgeSource {
  return {
    id: `src-${n}`,
    type: 'nas',
    name: `File ${n}`,
    path: `/Volumes/Sven/NAS/doc-${n}.md`,
    hash: 'abc',
    privacyClass: 'internal',
    lastFetched,
    freshnessTtlHours: 24,
    isStale: false,
    metadata: {},
  }
}

describe('GET /api/knowledge/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetIndexStatus.mockReturnValue({
      sourcesTotal: 0,
      staleSources: 0,
      lastIndexedAt: null,
      nasReachable: false,
      secondbrainReachable: false,
    })
    mockReadKnowledgeCards.mockReturnValue([])
  })

  it('returns zero counts when store is empty', async () => {
    mockGetCards.mockReturnValue([])
    mockGetSources.mockReturnValue([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as {
      cardCount: number
      sourceCount: number
      lastIndexedAt: string | null
      cardsByType: Record<string, number>
    }
    expect(body.cardCount).toBe(0)
    expect(body.sourceCount).toBe(0)
    expect(body.lastIndexedAt).toBeNull()
    expect(body.cardsByType).toEqual({})
  })

  it('counts cards and groups by type', async () => {
    mockGetCards.mockReturnValue([
      makeCard('learning', 1),
      makeCard('learning', 2),
      makeCard('decision', 3),
      makeCard('context', 4),
    ])
    mockGetSources.mockReturnValue([])

    const res = await GET()
    const body = await res.json() as { cardCount: number; cardsByType: Record<string, number> }
    expect(body.cardCount).toBe(4)
    expect(body.cardsByType).toEqual({ learning: 2, decision: 1, context: 1 })
  })

  it('returns lastIndexedAt from getIndexStatus', async () => {
    mockGetCards.mockReturnValue([])
    mockGetSources.mockReturnValue([makeNasSource(1, '2026-05-20T10:00:00.000Z')])
    mockGetIndexStatus.mockReturnValue({
      sourcesTotal: 1,
      staleSources: 0,
      lastIndexedAt: '2026-05-22T04:00:00.000Z',
      nasReachable: true,
      secondbrainReachable: false,
    })

    const res = await GET()
    const body = await res.json() as { lastIndexedAt: string }
    expect(body.lastIndexedAt).toBe('2026-05-22T04:00:00.000Z')
  })

  it('returns null lastIndexedAt when no sources indexed', async () => {
    mockGetCards.mockReturnValue([])
    mockGetSources.mockReturnValue([])
    mockGetIndexStatus.mockReturnValue({
      sourcesTotal: 0,
      staleSources: 0,
      lastIndexedAt: null,
      nasReachable: false,
      secondbrainReachable: false,
    })

    const res = await GET()
    const body = await res.json() as { lastIndexedAt: string | null }
    expect(body.lastIndexedAt).toBeNull()
  })

  it('includes delegationLessons count', async () => {
    mockGetCards.mockReturnValue([])
    mockGetSources.mockReturnValue([])
    mockReadKnowledgeCards.mockReturnValue([
      { id: 'kc1', title: 'Lesson 1', content: '...', source: 'delegation', sourceId: 'del-1', tags: [], createdAt: '', updatedAt: '' },
      { id: 'kc2', title: 'Lesson 2', content: '...', source: 'delegation', sourceId: 'del-2', tags: [], createdAt: '', updatedAt: '' },
    ])

    const res = await GET()
    const body = await res.json() as { delegationLessons: number }
    expect(body.delegationLessons).toBe(2)
  })

  it('exposes nasReachable and secondbrainReachable from index status', async () => {
    mockGetCards.mockReturnValue([])
    mockGetSources.mockReturnValue([])
    mockGetIndexStatus.mockReturnValue({
      sourcesTotal: 0,
      staleSources: 0,
      lastIndexedAt: null,
      nasReachable: true,
      secondbrainReachable: true,
    })

    const res = await GET()
    const body = await res.json() as { nasReachable: boolean; secondbrainReachable: boolean }
    expect(body.nasReachable).toBe(true)
    expect(body.secondbrainReachable).toBe(true)
  })
})
