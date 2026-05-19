import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs — cover both default import (route.ts) and named imports (knowledge/store.ts)
let mockDelegations = '[]'
let mockRuns = '{"runs":[]}'
let mockKnowledge = '{"sources":[],"items":[],"cards":[]}'

const fsMock = {
  existsSync: () => true,
  readFileSync: (p: string) => {
    if (p.includes('delegations.json')) return mockDelegations
    if (p.includes('orchestrated-runs.json')) return mockRuns
    if (p.includes('knowledge-store.json')) return mockKnowledge
    if (p.includes('skill-history.json')) return '{"outcomes":[],"updatedAt":"2026-01-01T00:00:00Z"}'
    if (p.includes('agent-confidence.json')) return '{"overrides":[]}'
    return '{}'
  },
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}

vi.mock('fs', () => ({ default: fsMock, ...fsMock }))

describe('GET /api/dashboard/stats', () => {
  beforeEach(() => {
    mockDelegations = '[]'
    mockRuns = '{"runs":[]}'
    mockKnowledge = '{"sources":[],"items":[],"cards":[]}'
  })

  it('returns zero stats when stores are empty', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as Awaited<ReturnType<typeof res.json>>

    expect(data.delegations.total).toBe(0)
    expect(data.orchestrations.total).toBe(0)
    expect(data.knowledge.cardCount).toBe(0)
    expect(data.generatedAt).toBeTruthy()
  })

  it('counts delegations by status', async () => {
    mockDelegations = JSON.stringify([
      { id: '1', status: 'running', contract: {}, createdAt: new Date().toISOString() },
      { id: '2', status: 'failed', contract: {}, createdAt: new Date().toISOString() },
      { id: '3', status: 'pending', contract: {}, createdAt: new Date().toISOString() },
      { id: '4', status: 'completed', contract: {}, createdAt: new Date().toISOString() },
    ])

    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as Awaited<ReturnType<typeof res.json>>

    expect(data.delegations.total).toBe(4)
    expect(data.delegations.running).toBe(1)
    expect(data.delegations.failed).toBe(1)
    expect(data.delegations.pending).toBe(1)
    expect(data.delegations.completed).toBe(1)
  })

  it('counts knowledge cards and recent cards', async () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago

    mockKnowledge = JSON.stringify({
      sources: [],
      items: [],
      cards: [
        { id: 'c1', type: 'learning', title: 'Recent', body: '', sourceIds: [], tags: [], privacyClass: 'internal', confidence: 'high', createdAt: recentDate, updatedAt: recentDate },
        { id: 'c2', type: 'learning', title: 'Old', body: '', sourceIds: [], tags: [], privacyClass: 'internal', confidence: 'high', createdAt: oldDate, updatedAt: oldDate },
      ],
    })

    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as Awaited<ReturnType<typeof res.json>>

    expect(data.knowledge.cardCount).toBe(2)
    expect(data.knowledge.recentCards).toBe(1)
  })

  it('includes generatedAt timestamp', async () => {
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as Awaited<ReturnType<typeof res.json>>

    expect(new Date(data.generatedAt as string).getTime()).toBeGreaterThan(0)
  })
})
