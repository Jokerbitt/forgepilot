import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { ScoredItem, WorkItem } from '@/lib/nba-engine/types'

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}))

vi.mock('@/lib/nba-engine/prioritizer', () => ({
  prioritizeJokItems: vi.fn((items: WorkItem[]): ScoredItem[] =>
    items.map((item, index) => ({ item, score: 100 - index, reasoning: [] })),
  ),
}))

beforeEach(() => {
  vi.resetModules()
})

function makeReq(url: string) {
  return new NextRequest(url)
}

function makeItems(count: number): WorkItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    title: `Item ${i}`,
    status: 'todo',
    priority: 1,
    riskClass: 'low',
  }))
}

describe('GET /api/recommendations', () => {
  it('returns 200 with items array and totalItems=0 when no files exist', async () => {
    const fs = await import('fs')
    vi.mocked(fs.default.existsSync).mockReturnValue(false)

    const { GET } = await import('./route')
    const res = await GET(makeReq('http://localhost/api/recommendations'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.totalItems).toBe(0)
    expect(typeof body.generatedAt).toBe('string')
  })

  it('respects ?limit= param', async () => {
    const fs = await import('fs')
    const items = makeItems(15)
    vi.mocked(fs.default.existsSync).mockReturnValue(true)
    vi.mocked(fs.default.readFileSync).mockReturnValue(JSON.stringify(items))

    const { prioritizeJokItems } = await import('@/lib/nba-engine/prioritizer')
    vi.mocked(prioritizeJokItems).mockImplementation((i: WorkItem[]) =>
      i.map((item, index) => ({ item, score: 100 - index, reasoning: [] })),
    )

    const { GET } = await import('./route')
    const res = await GET(makeReq('http://localhost/api/recommendations?limit=3'))
    const body = await res.json()

    expect(body.items).toHaveLength(3)
  })

  it('caps results at MAX_LIMIT (20) even if limit param is larger', async () => {
    const fs = await import('fs')
    const items = makeItems(25)
    vi.mocked(fs.default.existsSync).mockReturnValue(true)
    vi.mocked(fs.default.readFileSync).mockReturnValue(JSON.stringify(items))

    const { prioritizeJokItems } = await import('@/lib/nba-engine/prioritizer')
    vi.mocked(prioritizeJokItems).mockImplementation((i: WorkItem[]) =>
      i.map((item, index) => ({ item, score: 100 - index, reasoning: [] })),
    )

    const { GET } = await import('./route')
    const res = await GET(makeReq('http://localhost/api/recommendations?limit=99'))
    const body = await res.json()

    expect(body.items.length).toBeLessThanOrEqual(20)
  })
})
