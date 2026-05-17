import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import type { KnowledgeSource, MemoryCard, KnowledgeStore } from './types'

// Mock fs to avoid touching the real filesystem
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

import * as fs from 'fs'
import {
  readStore,
  upsertSource,
  deleteSource,
  getSources,
  upsertCard,
  deleteCard,
  getCards,
  queryCards,
} from './store'

const mockSource = (): KnowledgeSource => ({
  id: randomUUID(),
  type: 'nas',
  name: 'ForgePilot NAS',
  path: '/Volumes/Sven/NAS',
  hash: 'abc123',
  privacyClass: 'internal',
  lastFetched: '2026-05-18T00:00:00Z',
  freshnessTtlHours: 24,
  isStale: false,
  metadata: {},
})

const mockCard = (projectId?: string): MemoryCard => ({
  id: randomUUID(),
  type: 'decision',
  title: 'Local-first model routing',
  body: 'Sensitive data stays local. Cloud only with explicit approval.',
  sourceIds: [],
  projectId,
  tags: ['routing', 'privacy'],
  privacyClass: 'internal',
  confidence: 'high',
  createdAt: '2026-05-18T00:00:00Z',
  updatedAt: '2026-05-18T00:00:00Z',
})

function seedStore(store: KnowledgeStore) {
  vi.mocked(fs.existsSync).mockReturnValue(true)
  vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(store))
  vi.mocked(fs.writeFileSync).mockImplementation(() => {})
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fs.existsSync).mockReturnValue(false)
})

describe('readStore', () => {
  it('returns empty store when file does not exist', () => {
    const store = readStore()
    expect(store.sources).toHaveLength(0)
    expect(store.items).toHaveLength(0)
    expect(store.cards).toHaveLength(0)
  })

  it('parses existing store from disk', () => {
    const source = mockSource()
    seedStore({ sources: [source], items: [], cards: [] })
    const store = readStore()
    expect(store.sources).toHaveLength(1)
    expect(store.sources[0].id).toBe(source.id)
  })
})

describe('sources', () => {
  it('upserts a new source', () => {
    seedStore({ sources: [], items: [], cards: [] })
    const source = mockSource()
    upsertSource(source)
    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string) as KnowledgeStore
    expect(written.sources).toHaveLength(1)
    expect(written.sources[0].name).toBe(source.name)
  })

  it('updates existing source by id', () => {
    const source = mockSource()
    seedStore({ sources: [source], items: [], cards: [] })
    upsertSource({ ...source, name: 'Updated NAS' })
    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string) as KnowledgeStore
    expect(written.sources).toHaveLength(1)
    expect(written.sources[0].name).toBe('Updated NAS')
  })

  it('deletes a source and its items', () => {
    const source = mockSource()
    seedStore({ sources: [source], items: [{ id: 'i1', sourceId: source.id, title: 't', content: '', summary: '', tags: [], privacyClass: 'internal', confidence: 'high', tokenEstimate: 10, createdAt: '', updatedAt: '' }], cards: [] })
    deleteSource(source.id)
    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string) as KnowledgeStore
    expect(written.sources).toHaveLength(0)
    expect(written.items).toHaveLength(0)
  })

  it('getSources returns all sources', () => {
    const s1 = mockSource()
    const s2 = mockSource()
    seedStore({ sources: [s1, s2], items: [], cards: [] })
    expect(getSources()).toHaveLength(2)
  })
})

describe('memory cards', () => {
  it('upserts a new card', () => {
    seedStore({ sources: [], items: [], cards: [] })
    const card = mockCard('proj-1')
    upsertCard(card)
    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string) as KnowledgeStore
    expect(written.cards).toHaveLength(1)
    expect(written.cards[0].title).toBe(card.title)
  })

  it('updates existing card by id', () => {
    const card = mockCard()
    seedStore({ sources: [], items: [], cards: [card] })
    upsertCard({ ...card, title: 'Updated title' })
    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string) as KnowledgeStore
    expect(written.cards).toHaveLength(1)
    expect(written.cards[0].title).toBe('Updated title')
  })

  it('deletes a card', () => {
    const card = mockCard()
    seedStore({ sources: [], items: [], cards: [card] })
    const deleted = deleteCard(card.id)
    expect(deleted).toBe(true)
  })

  it('getCards filters by projectId', () => {
    const c1 = mockCard('proj-a')
    const c2 = mockCard('proj-b')
    seedStore({ sources: [], items: [], cards: [c1, c2] })
    expect(getCards('proj-a')).toHaveLength(1)
    expect(getCards('proj-a')[0].id).toBe(c1.id)
  })

  it('queryCards filters by tags', () => {
    const c1 = mockCard()
    const c2 = { ...mockCard(), tags: ['unrelated'] }
    seedStore({ sources: [], items: [], cards: [c1, c2] })
    const results = queryCards({ tags: ['routing'] })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(c1.id)
  })

  it('queryCards respects limit', () => {
    const cards = [mockCard(), mockCard(), mockCard()]
    seedStore({ sources: [], items: [], cards })
    expect(queryCards({ limit: 2 })).toHaveLength(2)
  })
})
