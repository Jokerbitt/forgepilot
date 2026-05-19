import { NextRequest, NextResponse } from 'next/server'
import { readResearchDocuments } from '@/lib/knowledge/research-store'
import type { ResearchDocument } from '@/lib/models/research'
import type { SearchResult } from '@/lib/knowledge/research-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, maxLen = 120): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

function extractHighlight(text: string, query: string, maxLen = 120): string | null {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return null
  // Center the match in a window of maxLen chars
  const half = Math.floor(maxLen / 2)
  const start = Math.max(0, idx - half)
  const end = Math.min(text.length, start + maxLen)
  const snippet = text.slice(start, end)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return truncate(prefix + snippet + suffix, maxLen + 2) // allow slight overflow for ellipsis
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const WEIGHTS = {
  title: 40,
  abstract: 25,
  keyFindings: 20,
  sections: 10,
  tags: 5,
}

function containsQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

function scoreDocument(doc: ResearchDocument, query: string): { score: number; highlights: string[] } {
  let score = 0
  const highlights: string[] = []

  // Title (topic field)
  if (containsQuery(doc.topic, query)) {
    score += WEIGHTS.title
    const h = extractHighlight(doc.topic, query)
    if (h) highlights.push(h)
  }

  // Abstract
  if (doc.abstract && containsQuery(doc.abstract, query)) {
    score += WEIGHTS.abstract
    const h = extractHighlight(doc.abstract, query)
    if (h) highlights.push(h)
  }

  // Key findings
  let foundInKeyFindings = false
  for (const finding of doc.keyFindings) {
    if (containsQuery(finding, query)) {
      if (!foundInKeyFindings) {
        score += WEIGHTS.keyFindings
        foundInKeyFindings = true
      }
      const h = extractHighlight(finding, query)
      if (h) highlights.push(h)
    }
  }

  // Sections content
  let foundInSections = false
  for (const section of doc.sections) {
    if (containsQuery(section.content, query)) {
      if (!foundInSections) {
        score += WEIGHTS.sections
        foundInSections = true
      }
      const h = extractHighlight(section.content, query)
      if (h) highlights.push(h)
    }
  }

  // Tags
  if (doc.tags.some(tag => containsQuery(tag, query))) {
    score += WEIGHTS.tags
    const matchedTags = doc.tags.filter(tag => containsQuery(tag, query))
    highlights.push(matchedTags.join(', '))
  }

  return {
    score,
    highlights: highlights.slice(0, 3),
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export function GET(request: NextRequest): NextResponse {
  const { searchParams } = new URL(request.url)
  const rawQuery = searchParams.get('q')

  if (rawQuery === null || rawQuery === undefined) {
    return NextResponse.json({ error: 'q parameter required' }, { status: 400 })
  }

  const query = rawQuery.trim()

  if (!query) {
    return NextResponse.json({ error: 'q parameter required' }, { status: 400 })
  }

  if (query.length < 2) {
    return NextResponse.json({ error: 'q must be at least 2 characters' }, { status: 400 })
  }

  const docs = readResearchDocuments()

  const results: SearchResult[] = docs
    .map(doc => {
      const { score, highlights } = scoreDocument(doc, query)
      return {
        id: doc.id,
        title: doc.topic,
        score,
        highlights,
        status: doc.status,
        completedAt: doc.completedAt,
      }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  return NextResponse.json(results)
}
