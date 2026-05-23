import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock fs module before importing the module under test ───────────────────
const fakeStore: { cards: unknown[] } = { cards: [] }

vi.mock('fs', () => {
  const existsSync = vi.fn(() => true)
  const readFileSync = vi.fn(() => JSON.stringify(fakeStore))
  const writeFileSync = vi.fn((_, data: string) => {
    const parsed = JSON.parse(data) as { cards: unknown[] }
    fakeStore.cards = parsed.cards
  })
  const mkdirSync = vi.fn()
  return { existsSync, readFileSync, writeFileSync, mkdirSync }
})

import {
  readKnowledgeCards,
  writeKnowledgeCard,
  findKnowledgeCardsBySource,
  findKnowledgeCardById,
  deleteKnowledgeCard,
  updateKnowledgeCard,
  searchKnowledgeCards,
} from './knowledge-card'

beforeEach(() => {
  fakeStore.cards = []
})

describe('readKnowledgeCards', () => {
  it('returns empty array when store is empty', () => {
    expect(readKnowledgeCards()).toEqual([])
  })
})

describe('writeKnowledgeCard', () => {
  it('writes a card and reads it back', () => {
    const card = writeKnowledgeCard({
      title: 'Test lesson',
      content: '- learned something\n- useful',
      source: 'delegation',
      sourceId: 'del-1',
      tags: ['delegation', 'B', 'claude-cli'],
    })

    expect(card.id).toBeTruthy()
    expect(card.createdAt).toBeTruthy()
    expect(card.updatedAt).toBeTruthy()
    expect(card.title).toBe('Test lesson')

    const all = readKnowledgeCards()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(card.id)
  })

  it('includes optional fields when provided', () => {
    const card = writeKnowledgeCard({
      title: 'With PR',
      content: '- learned',
      source: 'delegation',
      sourceId: 'del-2',
      briefId: 'brief-1',
      prUrl: 'https://github.com/org/repo/pull/42',
      tags: ['delegation', 'A', 'local-agent'],
    })

    expect(card.briefId).toBe('brief-1')
    expect(card.prUrl).toBe('https://github.com/org/repo/pull/42')
  })

  it('enforces MAX_CARDS=500 by evicting oldest entries', () => {
    // Pre-populate with 500 cards
    const old: unknown[] = []
    for (let i = 0; i < 500; i++) {
      old.push({
        id: `old-${i}`,
        title: `Old card ${i}`,
        content: '',
        source: 'delegation',
        sourceId: `del-old-${i}`,
        tags: [],
        createdAt: new Date(Date.now() - (500 - i) * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    fakeStore.cards = old

    // Write one more
    writeKnowledgeCard({
      title: 'New card',
      content: '- new',
      source: 'delegation',
      sourceId: 'del-new',
      tags: [],
    })

    const all = readKnowledgeCards()
    expect(all).toHaveLength(500)
    // Oldest should be gone, newest should be present
    expect(all.some(c => c.title === 'New card')).toBe(true)
    expect(all.some(c => c.title === 'Old card 0')).toBe(false)
  })
})

describe('findKnowledgeCardsBySource', () => {
  it('returns only cards matching the sourceId', () => {
    writeKnowledgeCard({ title: 'A', content: '', source: 'delegation', sourceId: 'del-A', tags: [] })
    writeKnowledgeCard({ title: 'B', content: '', source: 'delegation', sourceId: 'del-B', tags: [] })
    writeKnowledgeCard({ title: 'A2', content: '', source: 'delegation', sourceId: 'del-A', tags: [] })

    const results = findKnowledgeCardsBySource('del-A')
    expect(results).toHaveLength(2)
    expect(results.every(c => c.sourceId === 'del-A')).toBe(true)
  })

  it('returns empty array for unknown sourceId', () => {
    expect(findKnowledgeCardsBySource('nonexistent')).toEqual([])
  })
})

describe('findKnowledgeCardById', () => {
  it('returns the card with the matching id', () => {
    const card = writeKnowledgeCard({ title: 'Find me', content: 'x', source: 'delegation', sourceId: 'del-1', tags: [] })
    const found = findKnowledgeCardById(card.id)
    expect(found).toBeDefined()
    expect(found?.id).toBe(card.id)
  })

  it('returns undefined for unknown id', () => {
    expect(findKnowledgeCardById('ghost-id')).toBeUndefined()
  })
})

describe('deleteKnowledgeCard', () => {
  it('removes the card from the store and returns it', () => {
    const card = writeKnowledgeCard({ title: 'Delete me', content: 'x', source: 'delegation', sourceId: 'del-1', tags: [] })
    const deleted = deleteKnowledgeCard(card.id)
    expect(deleted).toBeDefined()
    expect(deleted?.id).toBe(card.id)
    expect(readKnowledgeCards()).toHaveLength(0)
  })

  it('returns undefined when card id does not exist', () => {
    expect(deleteKnowledgeCard('ghost-id')).toBeUndefined()
  })

  it('only removes the matching card, leaves others intact', () => {
    const c1 = writeKnowledgeCard({ title: 'Keep', content: '', source: 'delegation', sourceId: 'del-1', tags: [] })
    const c2 = writeKnowledgeCard({ title: 'Delete', content: '', source: 'delegation', sourceId: 'del-2', tags: [] })
    deleteKnowledgeCard(c2.id)
    const remaining = readKnowledgeCards()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(c1.id)
  })
})

describe('updateKnowledgeCard', () => {
  it('updates title and content, bumps updatedAt', async () => {
    const card = writeKnowledgeCard({ title: 'Old', content: 'old body', source: 'delegation', sourceId: 'del-1', tags: [] })
    const originalUpdatedAt = card.updatedAt

    // ensure at least 1 ms passes
    await new Promise(r => setTimeout(r, 2))

    const updated = updateKnowledgeCard(card.id, { title: 'New', content: 'new body' })
    expect(updated).toBeDefined()
    expect(updated?.title).toBe('New')
    expect(updated?.content).toBe('new body')
    expect(updated?.updatedAt).not.toBe(originalUpdatedAt)
  })

  it('preserves unpatched fields', () => {
    const card = writeKnowledgeCard({ title: 'T', content: 'C', source: 'delegation', sourceId: 'del-2', briefId: 'br-1', tags: ['x'] })
    const updated = updateKnowledgeCard(card.id, { title: 'T2' })
    expect(updated?.content).toBe('C')
    expect(updated?.tags).toEqual(['x'])
    expect(updated?.briefId).toBe('br-1')
    expect(updated?.sourceId).toBe('del-2')
  })

  it('returns undefined for unknown id', () => {
    expect(updateKnowledgeCard('ghost', { title: 'X' })).toBeUndefined()
  })

  it('updates the stored card (persisted read-back)', () => {
    const card = writeKnowledgeCard({ title: 'A', content: 'B', source: 'delegation', sourceId: 'del-3', tags: [] })
    updateKnowledgeCard(card.id, { tags: ['updated'] })
    const stored = findKnowledgeCardById(card.id)
    expect(stored?.tags).toEqual(['updated'])
  })
})

describe('searchKnowledgeCards', () => {
  it('returns all cards when query is empty', () => {
    writeKnowledgeCard({ title: 'A', content: 'x', source: 'delegation', sourceId: 'd1', tags: [] })
    writeKnowledgeCard({ title: 'B', content: 'y', source: 'delegation', sourceId: 'd2', tags: [] })
    expect(searchKnowledgeCards('')).toHaveLength(2)
  })

  it('matches by title (case-insensitive)', () => {
    writeKnowledgeCard({ title: 'TypeScript Patterns', content: 'x', source: 'delegation', sourceId: 'd1', tags: [] })
    writeKnowledgeCard({ title: 'Unrelated', content: 'y', source: 'delegation', sourceId: 'd2', tags: [] })
    const results = searchKnowledgeCards('typescript')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('TypeScript Patterns')
  })

  it('matches by content', () => {
    writeKnowledgeCard({ title: 'A', content: 'use zod for validation', source: 'delegation', sourceId: 'd1', tags: [] })
    writeKnowledgeCard({ title: 'B', content: 'unrelated content', source: 'delegation', sourceId: 'd2', tags: [] })
    const results = searchKnowledgeCards('zod')
    expect(results).toHaveLength(1)
  })

  it('matches by tag', () => {
    writeKnowledgeCard({ title: 'X', content: 'y', source: 'delegation', sourceId: 'd1', tags: ['api-route', 'typescript'] })
    writeKnowledgeCard({ title: 'Z', content: 'w', source: 'delegation', sourceId: 'd2', tags: ['css'] })
    expect(searchKnowledgeCards('api-route')).toHaveLength(1)
  })

  it('sorts title matches before content-only matches', () => {
    writeKnowledgeCard({ title: 'auth fix', content: 'unrelated', source: 'delegation', sourceId: 'd1', tags: [] })
    writeKnowledgeCard({ title: 'session work', content: 'implemented auth', source: 'delegation', sourceId: 'd2', tags: [] })
    const results = searchKnowledgeCards('auth')
    expect(results[0].title).toBe('auth fix')
  })
})
