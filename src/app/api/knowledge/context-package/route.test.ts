import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock knowledge store ─────────────────────────────────────────────────────

const mockCards = vi.hoisted(() => [
  {
    id: 'card-001',
    type: 'learning' as const,
    title: 'Postgres migration best practices',
    body: 'Run migrations with Drizzle. Always backup first. Use transactions for safety.',
    sourceIds: ['delegation-001'],
    projectId: 'brief-001',
    tags: ['delegation:delegation-001', 'auto-extracted'],
    privacyClass: 'internal' as const,
    confidence: 'high' as const,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'card-002',
    type: 'decision' as const,
    title: 'Use Drizzle ORM for database access',
    body: 'Decided to use Drizzle ORM instead of Prisma for better TypeScript inference and simpler query builder.',
    sourceIds: ['delegation-002'],
    tags: ['delegation:delegation-002', 'skill:data-model'],
    privacyClass: 'internal' as const,
    confidence: 'high' as const,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'card-003',
    type: 'pattern' as const,
    title: 'UI component pattern with Tailwind',
    body: 'Use cx() helper for conditional class names. Define component variants in primitives.tsx.',
    sourceIds: ['delegation-003'],
    tags: ['delegation:delegation-003', 'skill:ui-component'],
    privacyClass: 'internal' as const,
    confidence: 'medium' as const,
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
])

vi.mock('@/lib/knowledge/store', () => ({
  getCards: vi.fn(() => mockCards),
  upsertCard: vi.fn(),
  deleteCard: vi.fn(),
  queryCards: vi.fn(),
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/knowledge/context-package', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 400 when goal is missing', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/context-package', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('goal is required')
  })

  it('returns contextCards, tokenEstimate, sources', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/context-package', {
      method: 'POST',
      body: JSON.stringify({ goal: 'Add Postgres database migrations' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json() as { contextCards: unknown[]; tokenEstimate: number; sources: string[] }

    expect(Array.isArray(data.contextCards)).toBe(true)
    expect(typeof data.tokenEstimate).toBe('number')
    expect(Array.isArray(data.sources)).toBe(true)
  })

  it('returns relevant cards for Postgres-related goal', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/context-package', {
      method: 'POST',
      body: JSON.stringify({ goal: 'Add Postgres database migrations with Drizzle' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json() as { contextCards: Array<{ id: string }> }

    // card-001 (Postgres migration) and card-002 (Drizzle) should rank high
    const ids = data.contextCards.map(c => c.id)
    expect(ids).toContain('card-001')
    expect(ids).toContain('card-002')
  })

  it('respects maxCards limit', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/context-package', {
      method: 'POST',
      body: JSON.stringify({ goal: 'everything database drizzle postgres', maxCards: 1 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json() as { contextCards: unknown[] }

    expect(data.contextCards.length).toBeLessThanOrEqual(1)
  })

  it('tokenEstimate is within 2000 token budget', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/context-package', {
      method: 'POST',
      body: JSON.stringify({ goal: 'database migrations postgres drizzle' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json() as { tokenEstimate: number }

    expect(data.tokenEstimate).toBeLessThanOrEqual(2000)
  })

  it('boosts cards related to delegationId', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/context-package', {
      method: 'POST',
      body: JSON.stringify({
        goal: 'database postgres drizzle',
        delegationId: 'delegation-001',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json() as { contextCards: Array<{ id: string }> }

    // card-001 has delegation-001 in sourceIds → should be first
    expect(data.contextCards[0].id).toBe('card-001')
  })

  it('returns empty contextCards when no cards match goal', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/context-package', {
      method: 'POST',
      body: JSON.stringify({ goal: 'xyznonexistentterm987654321' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json() as { contextCards: unknown[]; tokenEstimate: number }

    expect(data.contextCards).toHaveLength(0)
    expect(data.tokenEstimate).toBe(0)
  })
})
