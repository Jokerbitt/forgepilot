import { describe, it, expect } from 'vitest'
import { computeQuality } from './route'
import type { ResearchDocument } from '@/lib/models/research'

// ─── Fixture factory ──────────────────────────────────────────────────────────

function makeDoc(partial: Partial<ResearchDocument> = {}): ResearchDocument {
  return {
    id: 'test-id',
    topic: 'Test Topic',
    status: 'completed',
    abstract: '',
    keyFindings: [],
    sections: [],
    citations: [],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeQuality', () => {
  it('returns perfect score for a well-sourced, complete document', () => {
    const doc = makeDoc({
      abstract: 'A thorough abstract covering the research topic.',
      keyFindings: ['Finding 1', 'Finding 2', 'Finding 3', 'Finding 4', 'Finding 5'],
      sections: [
        { heading: 'Intro', content: 'Content', citations: [] },
        { heading: 'Methods', content: 'Content', citations: [] },
        { heading: 'Results', content: 'Content', citations: [] },
        { heading: 'Discussion', content: 'Content', citations: [] },
      ],
      citations: [
        { id: '1', title: 'A', url: 'http://a.com', credibility: 'academic', excerpt: 'x' },
        { id: '2', title: 'B', url: 'http://b.com', credibility: 'academic', excerpt: 'x' },
        { id: '3', title: 'C', url: 'http://c.com', credibility: 'academic', excerpt: 'x' },
        { id: '4', title: 'D', url: 'http://d.com', credibility: 'academic', excerpt: 'x' },
        { id: '5', title: 'E', url: 'http://e.com', credibility: 'academic', excerpt: 'x' },
        { id: '6', title: 'F', url: 'http://f.com', credibility: 'academic', excerpt: 'x' },
        { id: '7', title: 'G', url: 'http://g.com', credibility: 'academic', excerpt: 'x' },
        { id: '8', title: 'H', url: 'http://h.com', credibility: 'academic', excerpt: 'x' },
      ],
    })
    const result = computeQuality(doc)
    // citations>=8 (+25) + academicRatio=1.0>=0.3 (+25) + sections>=4 (+20) + findings>=5 (+15) + abstract (+15) = 100
    expect(result.score).toBe(100)
    expect(result.grade).toBe('A')
    expect(result.breakdown.citationCount).toBe(8)
    expect(result.breakdown.academicRatio).toBe(1)
    expect(result.breakdown.hasAbstract).toBe(true)
  })

  it('returns zero score for an empty document', () => {
    const doc = makeDoc({ abstract: '' })
    const result = computeQuality(doc)
    expect(result.score).toBe(0)
    expect(result.grade).toBe('D')
    expect(result.breakdown.citationCount).toBe(0)
    expect(result.breakdown.academicRatio).toBe(0)
    expect(result.breakdown.officialRatio).toBe(0)
    expect(result.breakdown.sectionCount).toBe(0)
    expect(result.breakdown.keyFindingCount).toBe(0)
    expect(result.breakdown.hasAbstract).toBe(false)
  })

  it('assigns correct grade thresholds (A/B/C/D)', () => {
    // Grade A: score >= 80 → citations>=8 (+25) + academic>=0.3 (+25) + sections>=4 (+20) + abstract (+15) = 85 → A
    const gradeADoc = makeDoc({
      abstract: 'Some abstract',
      sections: [
        { heading: 'S1', content: '', citations: [] },
        { heading: 'S2', content: '', citations: [] },
        { heading: 'S3', content: '', citations: [] },
        { heading: 'S4', content: '', citations: [] },
      ],
      citations: [
        { id: '1', title: 'A', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '2', title: 'B', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '3', title: 'C', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '4', title: 'D', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '5', title: 'E', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '6', title: 'F', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '7', title: 'G', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '8', title: 'H', url: 'u', credibility: 'academic', excerpt: 'x' },
      ],
    })
    expect(computeQuality(gradeADoc).grade).toBe('A')

    // Grade B: ~65 → citations>=4 (+15) + academic>=0.1 (+15) + sections>=2 (+10) + abstract (+15) = 55 - need +findings
    // citations>=4 (+15) + academic>=0.1 (+15) + sections>=4 (+20) + abstract (+15) = 65 → B
    const gradeBDoc = makeDoc({
      abstract: 'Some abstract',
      sections: [
        { heading: 'S1', content: '', citations: [] },
        { heading: 'S2', content: '', citations: [] },
        { heading: 'S3', content: '', citations: [] },
        { heading: 'S4', content: '', citations: [] },
      ],
      citations: [
        { id: '1', title: 'A', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '2', title: 'B', url: 'u', credibility: 'general', excerpt: 'x' },
        { id: '3', title: 'C', url: 'u', credibility: 'general', excerpt: 'x' },
        { id: '4', title: 'D', url: 'u', credibility: 'general', excerpt: 'x' },
      ],
    })
    const gradeBResult = computeQuality(gradeBDoc)
    expect(gradeBResult.score).toBe(65) // 15+15+20+15
    expect(gradeBResult.grade).toBe('B')

    // Grade C: ~45 → citations>=1 (+5) + sections>=2 (+10) + keyFindings>=3 (+8) + abstract (+15) = 38 - slightly off
    // citations>=4 (+15) + sections>=2 (+10) + abstract (+15) = 40 → C
    const gradeCDoc = makeDoc({
      abstract: 'Short abstract',
      sections: [
        { heading: 'S1', content: '', citations: [] },
        { heading: 'S2', content: '', citations: [] },
      ],
      citations: [
        { id: '1', title: 'A', url: 'u', credibility: 'general', excerpt: 'x' },
        { id: '2', title: 'B', url: 'u', credibility: 'general', excerpt: 'x' },
        { id: '3', title: 'C', url: 'u', credibility: 'general', excerpt: 'x' },
        { id: '4', title: 'D', url: 'u', credibility: 'general', excerpt: 'x' },
      ],
    })
    const gradeCResult = computeQuality(gradeCDoc)
    expect(gradeCResult.score).toBe(40) // 15+10+15
    expect(gradeCResult.grade).toBe('C')

    // Grade D: < 40 → citations>=1 (+5) + sections>=2 (+10) = 15 → D
    const gradeDDoc = makeDoc({
      abstract: '',
      sections: [
        { heading: 'S1', content: '', citations: [] },
        { heading: 'S2', content: '', citations: [] },
      ],
      citations: [
        { id: '1', title: 'A', url: 'u', credibility: 'general', excerpt: 'x' },
      ],
    })
    const gradeDResult = computeQuality(gradeDDoc)
    expect(gradeDResult.score).toBe(15) // 5+10
    expect(gradeDResult.grade).toBe('D')
  })

  it('correctly calculates academicRatio and officialRatio', () => {
    const doc = makeDoc({
      citations: [
        { id: '1', title: 'A', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '2', title: 'B', url: 'u', credibility: 'academic', excerpt: 'x' },
        { id: '3', title: 'C', url: 'u', credibility: 'government', excerpt: 'x' },
        { id: '4', title: 'D', url: 'u', credibility: 'general', excerpt: 'x' },
      ],
    })
    const result = computeQuality(doc)
    expect(result.breakdown.academicRatio).toBe(0.5)
    expect(result.breakdown.officialRatio).toBe(0.25)
  })

  it('handles boundary: exactly 4 citations with no academic sources', () => {
    const doc = makeDoc({
      citations: [
        { id: '1', title: 'A', url: 'u', credibility: 'general', excerpt: 'x' },
        { id: '2', title: 'B', url: 'u', credibility: 'general', excerpt: 'x' },
        { id: '3', title: 'C', url: 'u', credibility: 'general', excerpt: 'x' },
        { id: '4', title: 'D', url: 'u', credibility: 'general', excerpt: 'x' },
      ],
    })
    const result = computeQuality(doc)
    // citations>=4 (+15) + no academic → +0 for academic = 15
    expect(result.breakdown.citationCount).toBe(4)
    expect(result.breakdown.academicRatio).toBe(0)
    expect(result.score).toBe(15)
    expect(result.grade).toBe('D')
  })
})
