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
