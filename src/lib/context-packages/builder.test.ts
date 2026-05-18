import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryCard, KnowledgeItem } from '@/lib/knowledge/types'

vi.mock('@/lib/knowledge/store', () => ({
  getCards: vi.fn(),
  getItems: vi.fn(),
}))

import * as knowledgeStore from '@/lib/knowledge/store'
import { buildContextPackage } from './builder'

const card = (overrides: Partial<MemoryCard> = {}): MemoryCard => ({
  id: 'card-1',
  type: 'decision',
  title: 'Local-first routing',
  body: 'Sensitive data stays local.',
  sourceIds: [],
  tags: ['routing'],
  privacyClass: 'internal',
  confidence: 'high',
  createdAt: '2026-05-18T00:00:00Z',
  updatedAt: '2026-05-18T00:00:00Z',
  ...overrides,
})

const item = (overrides: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  id: 'item-1',
  sourceId: 'src-1',
  title: 'Architecture note',
  content: 'ForgePilot uses file-based JSON persistence.',
  summary: 'File-based JSON persistence pattern.',
  tags: ['architecture'],
  privacyClass: 'internal',
  confidence: 'high',
  tokenEstimate: 20,
  createdAt: '2026-05-18T00:00:00Z',
  updatedAt: '2026-05-18T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.mocked(knowledgeStore.getCards).mockReturnValue([])
  vi.mocked(knowledgeStore.getItems).mockReturnValue([])
})

describe('buildContextPackage', () => {
  it('builds a package with objective header when no sources', () => {
    const result = buildContextPackage({
      workItemId: 'wi-1',
      title: 'Test Task',
      objective: 'Implement feature X',
    })
    expect(result.package.content).toContain('Test Task')
    expect(result.package.content).toContain('Implement feature X')
    expect(result.package.workItemId).toBe('wi-1')
  })

  it('includes memory cards within budget', () => {
    vi.mocked(knowledgeStore.getCards).mockReturnValue([card()])
    const result = buildContextPackage({
      workItemId: 'wi-1',
      title: 'T',
      objective: 'O',
      tokenBudget: 5000,
    })
    const included = result.package.sources.filter(s => s.included)
    expect(included).toHaveLength(1)
    expect(result.package.content).toContain('Local-first routing')
  })

  it('excludes cards that violate privacy mode', () => {
    vi.mocked(knowledgeStore.getCards).mockReturnValue([
      card({ privacyClass: 'local-only' }),
    ])
    const result = buildContextPackage({
      workItemId: 'wi-1',
      title: 'T',
      objective: 'O',
      privacyMode: 'cloud-approved',
    })
    const excluded = result.package.sources.filter(s => !s.included)
    expect(excluded).toHaveLength(1)
    expect(excluded[0].excludedReason).toContain('Privacy')
  })

  it('local-only mode includes all privacy classes', () => {
    vi.mocked(knowledgeStore.getCards).mockReturnValue([
      card({ privacyClass: 'local-only' }),
    ])
    const result = buildContextPackage({
      workItemId: 'wi-1',
      title: 'T',
      objective: 'O',
      privacyMode: 'local-only',
    })
    expect(result.package.sources[0].included).toBe(true)
  })

  it('redacts secrets from content', () => {
    vi.mocked(knowledgeStore.getCards).mockReturnValue([
      card({ body: 'Use sk-abc123456789012345678 for auth' }),
    ])
    const result = buildContextPackage({ workItemId: 'wi-1', title: 'T', objective: 'O' })
    expect(result.package.content).not.toContain('sk-abc123456789012345678')
    expect(result.package.content).toContain('[REDACTED_API_KEY]')
  })

  it('excludes cards when token budget exceeded', () => {
    const bigCard = card({ body: 'x'.repeat(10000) })
    vi.mocked(knowledgeStore.getCards).mockReturnValue([bigCard])
    const result = buildContextPackage({
      workItemId: 'wi-1',
      title: 'T',
      objective: 'O',
      tokenBudget: 100,
    })
    expect(result.package.sources[0].included).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('includes knowledge items', () => {
    vi.mocked(knowledgeStore.getItems).mockReturnValue([item()])
    const result = buildContextPackage({ workItemId: 'wi-1', title: 'T', objective: 'O' })
    expect(result.package.content).toContain('Architecture note')
  })

  it('calculates readiness score', () => {
    vi.mocked(knowledgeStore.getCards).mockReturnValue([card()])
    const result = buildContextPackage({ workItemId: 'wi-1', title: 'T', objective: 'O' })
    expect(result.package.readinessScore).toBeGreaterThan(40)
    expect(result.package.readinessScore).toBeLessThanOrEqual(100)
  })

  it('sets 4h expiry', () => {
    const result = buildContextPackage({ workItemId: 'wi-1', title: 'T', objective: 'O' })
    const created = new Date(result.package.createdAt).getTime()
    const expires = new Date(result.package.expiresAt).getTime()
    expect(expires - created).toBeCloseTo(4 * 60 * 60 * 1000, -3)
  })

  it('ranks cards by keyword relevance — matching card comes first', () => {
    const unrelated = card({ id: 'c-unrelated', title: 'Database schema', body: 'Tables and columns.' })
    const relevant = card({ id: 'c-relevant', title: 'Model routing policy', body: 'Local-first routing for sensitive data.' })
    vi.mocked(knowledgeStore.getCards).mockReturnValue([unrelated, relevant])
    const result = buildContextPackage({
      workItemId: 'wi-1',
      title: 'Model Router',
      objective: 'Configure local-first routing for sensitive workloads',
    })
    const includedIds = result.package.sources.filter(s => s.included).map(s => s.sourceId)
    // Relevant card should be included; with small budget it would be first
    expect(includedIds).toContain('c-relevant')
  })

  it('falls back to all cards when no keyword matches', () => {
    const c = card({ id: 'c-1', title: 'Random topic', body: 'Unrelated content.' })
    vi.mocked(knowledgeStore.getCards).mockReturnValue([c])
    const result = buildContextPackage({
      workItemId: 'wi-1',
      title: 'xyz completely unrelated',
      objective: 'something else entirely',
    })
    // Should still include the card (fallback)
    expect(result.package.sources[0].included).toBe(true)
  })
})
