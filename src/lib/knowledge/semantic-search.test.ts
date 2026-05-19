/**
 * Tests for Semantic Search — M90
 *
 * Exercises the keyword-fallback path (Supabase mocked to null).
 * Uses a temporary directory for the knowledge-store.json fixture.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// ── Mock Supabase so keyword fallback is always used ─────────────────────────
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => null,
  isSupabaseEnabled: () => false,
  resetSupabaseClient: () => undefined,
}))

import { searchKnowledgeCards } from './semantic-search'

// ── Isolate in temp directory ────────────────────────────────────────────────
let tmpDir: string

const SAMPLE_STORE = {
  cards: [
    {
      id: 'card-1',
      title: 'Authentication patterns',
      body: 'JWT tokens and OAuth2 flows for secure API access.',
      tags: ['auth', 'security', 'jwt'],
      type: 'concept',
    },
    {
      id: 'card-2',
      title: 'Database indexing',
      body: 'B-tree and hash indexes for query performance optimisation.',
      tags: ['database', 'postgres', 'performance'],
      type: 'concept',
    },
    {
      id: 'card-3',
      title: 'React hooks best practices',
      body: 'useEffect cleanup, dependency arrays, and custom hooks.',
      tags: ['react', 'hooks', 'frontend'],
      type: 'guide',
    },
  ],
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-search-test-'))
  process.env.FORGEPILOT_DATA_DIR = tmpDir
  fs.writeFileSync(
    path.join(tmpDir, 'knowledge-store.json'),
    JSON.stringify(SAMPLE_STORE),
    'utf-8',
  )
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.FORGEPILOT_DATA_DIR
})

// ── Keyword fallback ─────────────────────────────────────────────────────────

describe('searchKnowledgeCards — keyword fallback', () => {
  it('returns matching cards for a keyword query', async () => {
    const results = await searchKnowledgeCards('authentication jwt')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('card-1')
    expect(results[0].similarity).toBeGreaterThan(0)
  })

  it('returns empty array when no cards match the query', async () => {
    const results = await searchKnowledgeCards('quantum computing entanglement')
    expect(results).toEqual([])
  })

  it('respects the limit parameter', async () => {
    // 'database performance' matches card-2 well; limit=1
    const results = await searchKnowledgeCards('database indexes performance', undefined, 0.0, 1)
    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('returns empty array when knowledge-store.json does not exist', async () => {
    fs.unlinkSync(path.join(tmpDir, 'knowledge-store.json'))

    const results = await searchKnowledgeCards('authentication')
    expect(results).toEqual([])
  })

  it('returns empty array for a very short query (all words <= 2 chars)', async () => {
    const results = await searchKnowledgeCards('is a')
    expect(results).toEqual([])
  })

  it('orders results by descending similarity', async () => {
    // Both 'react hooks' and 'database' should appear; hooks card ranks higher for this query
    const results = await searchKnowledgeCards('react hooks frontend')

    if (results.length >= 2) {
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity)
    }
  })

  it('each result contains required SemanticSearchResult fields', async () => {
    const results = await searchKnowledgeCards('database postgres')

    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(typeof r.id).toBe('string')
      expect(typeof r.title).toBe('string')
      expect(typeof r.body).toBe('string')
      expect(Array.isArray(r.tags)).toBe(true)
      expect(typeof r.similarity).toBe('number')
    }
  })

  it('ignores embedding parameter when Supabase is not configured', async () => {
    // Passing an embedding should NOT cause an error — just use keyword fallback
    const fakeEmbedding = Array.from({ length: 384 }, (_, i) => i / 384)
    const results = await searchKnowledgeCards('authentication', fakeEmbedding)

    // With no Supabase the keyword path runs — we get results based on the text
    expect(Array.isArray(results)).toBe(true)
  })
})
