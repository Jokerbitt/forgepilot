import { describe, it, expect } from 'vitest'
import type { MemoryCard, KnowledgeSource, MemoryCardType } from '@/lib/knowledge/types'

function privacyTone(p: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (p === 'public') return 'success'
  if (p === 'internal') return 'neutral'
  if (p === 'sensitive') return 'warning'
  if (p === 'local-only') return 'danger'
  return 'neutral'
}

function confidenceColor(c: string): string {
  if (c === 'high') return 'text-emerald-400'
  if (c === 'medium') return 'text-amber-300'
  return 'text-slate-500'
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function sourceBadgeLabel(card: MemoryCard): string {
  if (card.projectId) return `#${card.projectId.slice(-8)}`
  if (card.sourceIds.length > 0) return `${card.sourceIds.length} Quelle${card.sourceIds.length > 1 ? 'n' : ''}`
  return 'manual'
}

const makeCard = (partial: Partial<MemoryCard> = {}): MemoryCard => ({
  id: 'card-1',
  type: 'decision',
  title: 'Use local-first architecture',
  body: 'All data stays local unless explicitly published.',
  sourceIds: [],
  tags: ['architecture', 'privacy'],
  privacyClass: 'internal',
  confidence: 'high',
  createdAt: '2026-05-18T10:00:00Z',
  updatedAt: '2026-05-18T10:00:00Z',
  ...partial,
})

const makeSource = (partial: Partial<KnowledgeSource> = {}): KnowledgeSource => ({
  id: 'src-1',
  type: 'nas',
  name: 'ForgePilot NAS',
  path: '/Volumes/Sven/NAS/Codex',
  hash: 'abc123',
  privacyClass: 'internal',
  lastFetched: '2026-05-18T10:00:00Z',
  freshnessTtlHours: 24,
  isStale: false,
  metadata: {},
  ...partial,
})

describe('Knowledge Center — display logic', () => {
  it('maps public privacy to success tone', () => {
    expect(privacyTone('public')).toBe('success')
  })

  it('maps sensitive privacy to warning tone', () => {
    expect(privacyTone('sensitive')).toBe('warning')
  })

  it('maps local-only privacy to danger tone', () => {
    expect(privacyTone('local-only')).toBe('danger')
  })

  it('maps internal privacy to neutral tone', () => {
    expect(privacyTone('internal')).toBe('neutral')
  })

  it('assigns emerald color to high confidence', () => {
    expect(confidenceColor('high')).toContain('emerald')
  })

  it('assigns amber color to medium confidence', () => {
    expect(confidenceColor('medium')).toContain('amber')
  })

  it('assigns slate color to low confidence', () => {
    expect(confidenceColor('low')).toContain('slate')
  })

  it('filters cards by type', () => {
    const cards: MemoryCard[] = [
      makeCard({ id: '1', type: 'decision' }),
      makeCard({ id: '2', type: 'learning' }),
      makeCard({ id: '3', type: 'decision' }),
    ]
    const filtered = cards.filter(c => c.type === 'decision')
    expect(filtered).toHaveLength(2)
  })

  it('counts stale sources correctly', () => {
    const sources: KnowledgeSource[] = [
      makeSource({ id: '1', isStale: false }),
      makeSource({ id: '2', isStale: true }),
      makeSource({ id: '3', isStale: true }),
    ]
    expect(sources.filter(s => s.isStale)).toHaveLength(2)
  })

  it('handles empty cards list', () => {
    const cards: MemoryCard[] = []
    const filtered = cards.filter(c => c.type === ('decision' as MemoryCardType))
    expect(filtered).toHaveLength(0)
  })
})

describe('Knowledge Center — truncate helper', () => {
  it('returns text unchanged when shorter than max', () => {
    expect(truncate('short text', 120)).toBe('short text')
  })

  it('truncates and appends ellipsis when longer than max', () => {
    const long = 'a'.repeat(130)
    const result = truncate(long, 120)
    expect(result).toHaveLength(121) // 120 chars + '…'
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns text unchanged at exactly max length', () => {
    const exact = 'b'.repeat(120)
    expect(truncate(exact, 120)).toBe(exact)
  })
})

describe('Knowledge Center — sourceBadgeLabel', () => {
  it('returns last 8 chars of projectId prefixed with #', () => {
    const card = makeCard({ projectId: 'proj-abc12345' })
    expect(sourceBadgeLabel(card)).toBe('#abc12345') // last 8 of 'proj-abc12345'
  })

  it('returns singular "Quelle" for 1 sourceId', () => {
    const card = makeCard({ sourceIds: ['src-1'] })
    expect(sourceBadgeLabel(card)).toBe('1 Quelle')
  })

  it('returns plural "Quellen" for multiple sourceIds', () => {
    const card = makeCard({ sourceIds: ['src-1', 'src-2', 'src-3'] })
    expect(sourceBadgeLabel(card)).toBe('3 Quellen')
  })

  it('returns "manual" when no projectId and no sourceIds', () => {
    const card = makeCard({ sourceIds: [] })
    expect(sourceBadgeLabel(card)).toBe('manual')
  })
})

describe('Knowledge Center — tag filter logic', () => {
  it('returns all cards when no tags are active', () => {
    const cards: MemoryCard[] = [
      makeCard({ id: '1', tags: ['arch', 'backend'] }),
      makeCard({ id: '2', tags: ['frontend'] }),
    ]
    const activeTags: string[] = []
    const filtered = cards.filter(c =>
      activeTags.length === 0 || activeTags.every(t => c.tags.includes(t))
    )
    expect(filtered).toHaveLength(2)
  })

  it('filters cards to only those matching all active tags', () => {
    const cards: MemoryCard[] = [
      makeCard({ id: '1', tags: ['arch', 'backend'] }),
      makeCard({ id: '2', tags: ['arch', 'frontend'] }),
      makeCard({ id: '3', tags: ['backend'] }),
    ]
    const activeTags = ['arch', 'backend']
    const filtered = cards.filter(c =>
      activeTags.every(t => c.tags.includes(t))
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('1')
  })

  it('extracts unique sorted tags from all cards', () => {
    const cards: MemoryCard[] = [
      makeCard({ id: '1', tags: ['zebra', 'apple'] }),
      makeCard({ id: '2', tags: ['apple', 'mango'] }),
    ]
    const allTags = Array.from(new Set(cards.flatMap(c => c.tags))).sort()
    expect(allTags).toEqual(['apple', 'mango', 'zebra'])
  })
})
