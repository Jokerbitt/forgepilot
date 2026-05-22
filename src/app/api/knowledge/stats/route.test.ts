import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryCard, KnowledgeSource } from '@/lib/knowledge/types'

vi.mock('@/lib/knowledge/store', () => ({
  getCards: vi.fn(),
  getSources: vi.fn(),
}))

import { GET } from './route'
import { getCards, getSources } from '@/lib/knowledge/store'

const mockGetCards = vi.mocked(getCards)
const mockGetSources = vi.mocked(getSources)

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

  it('returns the most recent NAS source lastFetched as lastIndexedAt', async () => {
    mockGetCards.mockReturnValue([])
    mockGetSources.mockReturnValue([
      makeNasSource(1, '2026-05-20T10:00:00.000Z'),
      makeNasSource(2, '2026-05-22T04:00:00.000Z'),
      makeNasSource(3, '2026-05-21T08:00:00.000Z'),
    ])

    const res = await GET()
    const body = await res.json() as { lastIndexedAt: string }
    expect(body.lastIndexedAt).toBe('2026-05-22T04:00:00.000Z')
  })

  it('ignores non-nas sources when computing lastIndexedAt', async () => {
    mockGetCards.mockReturnValue([])
    mockGetSources.mockReturnValue([
      {
        id: 'src-ext',
        type: 'github',
        name: 'GitHub',
        path: 'https://github.com/org/repo',
        hash: '',
        privacyClass: 'internal' as const,
        lastFetched: '2026-05-22T12:00:00.000Z',
        freshnessTtlHours: 1,
        isStale: false,
        metadata: {},
      },
    ])

    const res = await GET()
    const body = await res.json() as { lastIndexedAt: string | null }
    expect(body.lastIndexedAt).toBeNull()
  })
})
