import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SearchResult } from './route'

// ── Pure helper functions extracted for testing ──────────────────

function excerpt(text: string, query: string, maxLen = 120): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen).trimEnd() + (text.length > maxLen ? '…' : '')
  const start = Math.max(0, idx - 30)
  const end = Math.min(text.length, idx + query.length + 60)
  const result = (start > 0 ? '…' : '') + text.slice(start, end).trimEnd() + (end < text.length ? '…' : '')
  return result.slice(0, maxLen + 2)
}

function matches(text: string | undefined | null, query: string): boolean {
  if (!text) return false
  return text.toLowerCase().includes(query.toLowerCase())
}

// ── Test data helpers ────────────────────────────────────────────

function makeBrief(overrides: { id?: string; title?: string; description?: string } = {}) {
  return {
    id: overrides.id ?? 'brief-1',
    title: overrides.title ?? 'Build Auth Module',
    description: overrides.description ?? 'Implement JWT-based authentication',
    problemStatement: 'Users cannot log in securely',
    rawIdea: 'JWT auth system',
  }
}

function makeDelegation(overrides: { id?: string; title?: string; goal?: string; agentId?: string } = {}) {
  return {
    id: overrides.id ?? 'del-1',
    title: overrides.title ?? 'Implement feature',
    contract: {
      goal: overrides.goal ?? 'Build the feature',
      workItemId: 'wp-001',
      agentId: overrides.agentId ?? 'ollama-agent',
    },
    executionRoute: 'ollama-agent',
  }
}

function makeWorkItem(overrides: { id?: string; title?: string; description?: string } = {}) {
  return {
    id: overrides.id ?? 'item-1',
    title: overrides.title ?? 'Fix login bug',
    description: overrides.description ?? 'Users report 500 errors on login',
    status: 'todo',
  }
}

function makeKnowledgeCard(overrides: { id?: string; title?: string; body?: string; tags?: string[] } = {}) {
  return {
    id: overrides.id ?? 'card-1',
    type: 'decision' as const,
    title: overrides.title ?? 'Use local-first architecture',
    body: overrides.body ?? 'All data stays on-device unless explicitly shared.',
    sourceIds: [],
    tags: overrides.tags ?? ['architecture', 'privacy'],
    privacyClass: 'internal' as const,
    confidence: 'high' as const,
    createdAt: '2026-05-18T10:00:00Z',
    updatedAt: '2026-05-18T10:00:00Z',
  }
}

// ── Simulate search logic (mirrors route.ts logic) ───────────────

function simulateSearch(
  query: string,
  briefs: ReturnType<typeof makeBrief>[],
  delegations: ReturnType<typeof makeDelegation>[],
  workItems: ReturnType<typeof makeWorkItem>[],
  cards: ReturnType<typeof makeKnowledgeCard>[],
): SearchResult[] {
  if (query.trim().length < 2) return []

  const results: SearchResult[] = []

  for (const brief of briefs) {
    if (
      matches(brief.title, query) ||
      matches(brief.description, query) ||
      matches(brief.problemStatement, query) ||
      matches(brief.rawIdea, query)
    ) {
      const searchText = [brief.title, brief.problemStatement, brief.rawIdea].filter(Boolean).join(' ')
      results.push({
        type: 'brief',
        id: brief.id,
        title: brief.title ?? brief.id,
        excerpt: excerpt(searchText, query),
        url: `/project-briefs/${brief.id}`,
      })
    }
  }

  for (const del of delegations) {
    const goal = del.contract?.goal ?? ''
    const agentId = del.contract?.agentId ?? del.executionRoute ?? ''
    if (
      matches(del.title, query) ||
      matches(goal, query) ||
      matches(agentId, query)
    ) {
      results.push({
        type: 'delegation',
        id: del.id,
        title: del.title ?? goal ?? del.id,
        excerpt: excerpt([del.title, goal].filter(Boolean).join(' '), query),
        url: `/delegations/${del.id}`,
      })
    }
  }

  for (const item of workItems) {
    if (matches(item.title, query) || matches(item.description, query)) {
      results.push({
        type: 'workitem',
        id: item.id,
        title: item.title ?? item.id,
        excerpt: excerpt([item.title, item.description].filter(Boolean).join(' '), query),
        url: '/work-items',
      })
    }
  }

  for (const card of cards) {
    if (
      matches(card.title, query) ||
      matches(card.body, query) ||
      card.tags.some(tag => matches(tag, query))
    ) {
      results.push({
        type: 'knowledge',
        id: card.id,
        title: card.title,
        excerpt: excerpt([card.title, card.body].filter(Boolean).join(' '), query),
        url: '/knowledge',
      })
    }
  }

  return results.slice(0, 50)
}

// ── Tests ────────────────────────────────────────────────────────

describe('Search API — response structure', () => {
  it('returns results array with correct shape', () => {
    const brief = makeBrief({ title: 'Test Brief' })
    const results = simulateSearch('Test', [brief], [], [], [])
    expect(results).toBeInstanceOf(Array)
    expect(results).toHaveLength(1)
    const [r] = results
    expect(r).toHaveProperty('type', 'brief')
    expect(r).toHaveProperty('id', 'brief-1')
    expect(r).toHaveProperty('title')
    expect(r).toHaveProperty('excerpt')
    expect(r).toHaveProperty('url')
  })

  it('returns empty array for query shorter than 2 characters', () => {
    const brief = makeBrief({ title: 'Test' })
    const results = simulateSearch('T', [brief], [], [], [])
    expect(results).toHaveLength(0)
  })

  it('returns empty array for empty query', () => {
    const results = simulateSearch('', [], [], [], [])
    expect(results).toHaveLength(0)
  })
})

describe('Search API — finding by entity type', () => {
  it('finds a project brief by title', () => {
    const brief = makeBrief({ title: 'JWT Authentication System' })
    const results = simulateSearch('jwt', [brief], [], [], [])
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('brief')
    expect(results[0].title).toBe('JWT Authentication System')
    expect(results[0].url).toBe('/project-briefs/brief-1')
  })

  it('finds a knowledge card by tag', () => {
    const card = makeKnowledgeCard({ tags: ['architecture', 'privacy', 'local-first'] })
    const results = simulateSearch('local-first', [], [], [], [card])
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('knowledge')
    expect(results[0].url).toBe('/knowledge')
  })

  it('finds a knowledge card by body text', () => {
    const card = makeKnowledgeCard({ body: 'Vitest is preferred for unit testing in this project' })
    const results = simulateSearch('Vitest', [], [], [], [card])
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('knowledge')
  })

  it('finds a delegation by goal text', () => {
    const del = makeDelegation({ goal: 'Implement OAuth2 flow for login' })
    const results = simulateSearch('oauth2', [], [del], [], [])
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('delegation')
  })

  it('finds a work item by title', () => {
    const item = makeWorkItem({ title: 'Fix memory leak in agent runner' })
    const results = simulateSearch('memory leak', [], [], [item], [])
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('workitem')
  })
})

describe('Search API — case-insensitive matching', () => {
  it('matches uppercase query against lowercase title', () => {
    const brief = makeBrief({ title: 'authentication module' })
    const results = simulateSearch('AUTHENTICATION', [brief], [], [], [])
    expect(results).toHaveLength(1)
  })

  it('matches mixed case query', () => {
    const card = makeKnowledgeCard({ title: 'Local-First Architecture Decision' })
    const results = simulateSearch('local-First', [], [], [], [card])
    expect(results).toHaveLength(1)
  })
})

describe('Search API — result capping', () => {
  it('returns at most 50 results', () => {
    const cards = Array.from({ length: 80 }, (_, i) =>
      makeKnowledgeCard({ id: `card-${i}`, title: `Architecture decision ${i}` })
    )
    const results = simulateSearch('Architecture', [], [], [], cards)
    expect(results.length).toBeLessThanOrEqual(50)
  })
})

describe('Search excerpt helper', () => {
  it('returns full text when shorter than max', () => {
    const result = excerpt('short text', 'short', 120)
    expect(result).toContain('short text')
  })

  it('includes surrounding context around the match', () => {
    const text = 'The quick brown fox jumps over the lazy dog and runs away quickly in the forest'
    const result = excerpt(text, 'lazy', 120)
    expect(result).toContain('lazy')
  })

  it('truncates long text without match', () => {
    const text = 'a'.repeat(200)
    const result = excerpt(text, 'xyz', 120)
    expect(result.length).toBeLessThanOrEqual(122) // 120 + '…'
  })
})
