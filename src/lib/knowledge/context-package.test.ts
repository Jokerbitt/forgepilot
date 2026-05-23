import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the knowledgeCardRepository
vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: vi.fn(),
}))

vi.mock('@/lib/repositories/base', () => ({
  SINGLE_TENANT_USER_ID: 'local-user',
}))

vi.mock('./knowledge-card', () => ({
  readKnowledgeCards: vi.fn(() => []),
}))

import { buildContextPackage } from './context-package'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { readKnowledgeCards } from './knowledge-card'
import type { MemoryCard } from './types'

const makeCard = (overrides: Partial<MemoryCard> = {}): MemoryCard => ({
  id: 'card-1',
  type: 'learning',
  title: 'Test Card',
  body: 'Some body text',
  sourceIds: ['src-1'],
  tags: [],
  privacyClass: 'internal',
  confidence: 'medium',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('buildContextPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readKnowledgeCards).mockReturnValue([])
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

    const result = await buildContextPackage('implement authentication system')
    expect(result.cards).toHaveLength(0)
    expect(result.tokenEstimate).toBe(0)
    expect(result.sources).toHaveLength(0)
  })

  it('scores cards by keyword overlap with goal', async () => {
    const relevantCard = makeCard({
      id: 'card-relevant',
      title: 'Authentication patterns',
      body: 'Authentication should use JWT tokens for secure session management',
      tags: ['auth', 'security'],
    })
    const irrelevantCard = makeCard({
      id: 'card-irrelevant',
      title: 'Database migrations',
      body: 'Run drizzle migrations before deployment',
      tags: ['db'],
    })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([irrelevantCard, relevantCard]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('implement authentication system with tokens')
    expect(result.cards.length).toBeGreaterThan(0)
    expect(result.cards[0].id).toBe('card-relevant')
  })

  it('respects maxCards option', async () => {
    const cards = Array.from({ length: 6 }, (_, i) =>
      makeCard({
        id: `card-${i}`,
        title: `Feature card ${i}`,
        body: 'feature implementation pattern',
        tags: ['feature'],
      })
    )

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue(cards),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('implement feature for users', { maxCards: 2 })
    expect(result.cards.length).toBeLessThanOrEqual(2)
  })

  it('returns empty result when repository throws', async () => {
    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('implement something')
    expect(result.cards).toHaveLength(0)
    expect(result.tokenEstimate).toBe(0)
    expect(result.sources).toHaveLength(0)
  })

  it('computes tokenEstimate from card content', async () => {
    const card = makeCard({
      id: 'card-token',
      title: 'Auth guide',
      body: 'Use JWT for authentication. Validate tokens on every request.',
      tags: ['auth'],
    })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([card]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('implement authentication tokens')
    expect(result.tokenEstimate).toBeGreaterThan(0)
    const expectedEstimate = Math.ceil((card.title.length + card.body.length) / 4)
    expect(result.tokenEstimate).toBe(expectedEstimate)
  })

  it('collects sources from matched cards', async () => {
    const card1 = makeCard({ id: 'c1', title: 'Auth pattern', body: 'authentication guide', tags: [], sourceIds: ['src-abc', 'src-xyz'] })
    const card2 = makeCard({ id: 'c2', title: 'Auth testing', body: 'authentication test examples', tags: [], sourceIds: ['src-abc'] })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([card1, card2]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('implement authentication flow')
    // Sources should be deduplicated
    const uniqueSources = [...new Set(result.sources)]
    expect(result.sources).toEqual(uniqueSources)
  })

  it('includes delegation lesson knowledge cards as synthetic memory cards', async () => {
    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })
    vi.mocked(readKnowledgeCards).mockReturnValue([
      {
        id: 'lesson-1',
        title: 'Authentication retry lesson',
        content: 'Retry authentication requests only after validating the session token.',
        source: 'delegation',
        sourceId: 'delegation-1',
        tags: ['auth', 'retry'],
        createdAt: '2026-05-23T08:00:00.000Z',
        updatedAt: '2026-05-23T08:00:00.000Z',
      },
    ])

    const result = await buildContextPackage('authentication retry session')
    expect(result.cards[0].id).toBe('kc:lesson-1')
    expect(result.sources).toContain('delegation-1')
  })

  // ── M288: TF-IDF-like scoring improvements ────────────────────────────────────

  it('M288: title match scores higher than body-only match', async () => {
    const titleCard = makeCard({
      id: 'title-match',
      title: 'Authentication system design',
      body: 'Some unrelated content here',
      tags: [],
    })
    const bodyCard = makeCard({
      id: 'body-match',
      title: 'Unrelated topic',
      body: 'authentication is mentioned here once',
      tags: [],
    })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([bodyCard, titleCard]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('authentication system')
    // Title card should rank first because title matches are weighted 3x
    expect(result.cards[0].id).toBe('title-match')
  })

  it('M288: tag match boosts score above body-only match', async () => {
    const tagCard = makeCard({
      id: 'tag-match',
      title: 'Unrelated title',
      body: 'some body content without keywords',
      tags: ['authentication', 'jwt'],
    })
    const bodyCard = makeCard({
      id: 'body-match',
      title: 'No tag here',
      body: 'authentication mentioned in body once',
      tags: [],
    })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([bodyCard, tagCard]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('authentication token')
    // tag-match has "authentication" in tags (2pt) + body body (0) vs body-match body (1pt)
    expect(result.cards[0].id).toBe('tag-match')
  })

  it('M288: repeated keyword in body increases score', async () => {
    const highFreqCard = makeCard({
      id: 'high-freq',
      title: 'Some card',
      body: 'authentication authentication authentication is very important here for proper authentication',
      tags: [],
    })
    const lowFreqCard = makeCard({
      id: 'low-freq',
      title: 'Some other card',
      body: 'authentication is mentioned once',
      tags: [],
    })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([lowFreqCard, highFreqCard]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    const result = await buildContextPackage('authentication token')
    expect(result.cards[0].id).toBe('high-freq')
  })

  it('M288: bigrams score higher than individual terms', async () => {
    const bigramCard = makeCard({
      id: 'bigram-match',
      title: 'Component library patterns',
      body: 'react hooks are essential for modern frontend development',
      tags: [],
    })
    const unigramCard = makeCard({
      id: 'unigram-match',
      title: 'Some page about react',
      body: 'hooks can also be used in testing',
      tags: [],
    })

    vi.mocked(createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([unigramCard, bigramCard]),
      create: vi.fn(),
      findById: vi.fn(),
      listByDelegation: vi.fn(),
      listByType: vi.fn(),
      upsert: vi.fn(),
    })

    // "react hooks" is a bigram → bigramCard body contains "react hooks" → extra score
    const result = await buildContextPackage('migrate react hooks component')
    expect(result.cards[0].id).toBe('bigram-match')
  })
})
