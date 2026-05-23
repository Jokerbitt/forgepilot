import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({ linear: null, github: null })),
}))

vi.mock('@/lib/planning/grok-planning-gateway', async () => {
  const actual = await vi.importActual<typeof import('@/lib/planning/grok-planning-gateway')>(
    '@/lib/planning/grok-planning-gateway',
  )
  return {
    ...actual,
    applyPlanningItems: vi.fn(async (_items: unknown, _opts: unknown) => ({
      created: [],
      skipped: [],
    })),
  }
})

vi.mock('@/lib/planning/planning-audit-store', () => ({
  recordPlanningAudit: vi.fn(() => ({ id: 'audit-001' })),
  listPlanningAuditRecords: vi.fn(() => []),
  getPlanningAuditStats: vi.fn(() => ({
    total: 0,
    last24h: 0,
    byMode: {},
    byOutcome: {},
  })),
}))

const VALID_PLAN = {
  milestones: [
    {
      title: 'Auth System',
      goal: 'Implement secure JWT-based authentication for all API routes.',
      priority: 'P1' as const,
      system: 'both' as const,
      acceptanceCriteria: ['All routes require valid JWT'],
      issues: [
        {
          title: 'Add JWT middleware',
          description: 'Implement JWT validation middleware for Next.js API routes using jsonwebtoken.',
          priority: 'P1' as const,
          owner: 'codex' as const,
          acceptanceCriteria: ['Middleware rejects requests without valid token'],
          labels: ['auth', 'feature'],
          writeScope: ['src/lib/auth/**'],
          verification: ['npm run test:run'],
        },
      ],
    },
  ],
  doNotBuild: ['OAuth social login — out of scope for MVP'],
  risks: [
    {
      title: 'Token expiry confusion',
      severity: 'medium' as const,
      mitigation: 'Use short-lived access tokens with refresh flow.',
    },
  ],
}

describe('GET /api/planning/grok', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns service info and the Grok prompt', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/planning/grok')
    const res = await GET()
    const data = await res.json() as { ok: boolean; service: string; prompt: string; modes: string[] }

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.service).toContain('Grok')
    expect(typeof data.prompt).toBe('string')
    expect(data.prompt.length).toBeGreaterThan(100)
    expect(data.modes).toContain('preview')
    expect(data.modes).toContain('create-all')
  })
})

describe('POST /api/planning/grok', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns preview result without creating issues (mode=preview)', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/planning/grok?mode=preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionPlan: VALID_PLAN }),
    })
    const res = await POST(req)
    const data = await res.json() as { ok: boolean; mode: string; warnings: string[] }

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.mode).toBe('preview')
    expect(data.warnings).toContain('Preview only: no GitHub or Linear issues were created.')
  })

  it('returns 409 when mode=create-all without confirmation header', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/planning/grok?mode=create-all', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionPlan: VALID_PLAN }),
    })
    const res = await POST(req)
    const data = await res.json() as { error: string; requiredHeader: string }

    expect(res.status).toBe(409)
    expect(data.requiredHeader).toBe('x-forgepilot-confirm')
  })

  it('returns 200 when mode=create-all with confirmation header', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/planning/grok?mode=create-all', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forgepilot-confirm': 'create-planning-items',
      },
      body: JSON.stringify({ actionPlan: VALID_PLAN }),
    })
    const res = await POST(req)
    const data = await res.json() as { ok: boolean; mode: string }

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.mode).toBe('create-all')
  })

  it('returns 400 for invalid mode', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/planning/grok?mode=invalid', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionPlan: VALID_PLAN }),
    })
    const res = await POST(req)
    const data = await res.json() as { error: string }

    expect(res.status).toBe(400)
    expect(data.error).toContain('Invalid mode')
  })

  it('returns 400 when Zod validation fails (missing required fields)', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/planning/grok?mode=preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionPlan: { milestones: [] } }),
    })
    const res = await POST(req)
    const data = await res.json() as { error: string; issues: unknown[] }

    expect(res.status).toBe(400)
    expect(data.error).toContain('Invalid Grok planning payload')
    expect(Array.isArray(data.issues)).toBe(true)
  })

  it('returns 400 when payload contains secrets', async () => {
    const { POST } = await import('./route')
    const dangerousPlan = {
      ...VALID_PLAN,
      milestones: [
        {
          ...VALID_PLAN.milestones[0],
          issues: [
            {
              ...VALID_PLAN.milestones[0].issues[0],
              description: 'ANTHROPIC_API_KEY=sk-ant-api03-REAL_SECRET_HERE set this in the env file',
            },
          ],
        },
      ],
    }
    const req = new Request('http://localhost/api/planning/grok?mode=preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionPlan: dangerousPlan }),
    })
    const res = await POST(req)
    const data = await res.json() as { error: string }

    expect(res.status).toBe(400)
    expect(data.error).toContain('Unsafe Grok planning payload')
  })

  it('accepts raw actionPlan without wrapper object', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/planning/grok?mode=preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_PLAN),
    })
    const res = await POST(req)
    const data = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
  })

  it('response includes audit record ID', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/planning/grok?mode=preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionPlan: VALID_PLAN }),
    })
    const res = await POST(req)
    const data = await res.json() as { auditRecordId: string }

    expect(typeof data.auditRecordId).toBe('string')
  })
})

describe('GET /api/planning/grok/audit', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns records and stats', async () => {
    const { GET } = await import('./audit/route')
    const req = new Request('http://localhost/api/planning/grok/audit')
    const res = await GET(req)
    const data = await res.json() as { ok: boolean; records: unknown[]; stats: unknown }

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(Array.isArray(data.records)).toBe(true)
    expect(typeof data.stats).toBe('object')
  })

  it('respects limit parameter', async () => {
    const { listPlanningAuditRecords } = await import('@/lib/planning/planning-audit-store')
    const { GET } = await import('./audit/route')
    const req = new Request('http://localhost/api/planning/grok/audit?limit=10')
    await GET(req)

    expect(vi.mocked(listPlanningAuditRecords)).toHaveBeenCalledWith(10)
  })
})
