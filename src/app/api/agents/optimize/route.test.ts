import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/agents/work-quality', () => ({
  scoreWork: vi.fn(),
}))
vi.mock('@/lib/agents/skill-evolver', () => ({
  recordOutcome: vi.fn(),
  getDriftWarnings: vi.fn(),
  getPerformanceSummaries: vi.fn().mockReturnValue([]),
  seedDemoOutcomes: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const VALID_OPTIMIZE_BODY = {
  task: {
    id: 'task-1',
    title: 'Add auth tests',
    description: 'Write tests for auth module',
    acceptanceCriteria: ['Tests pass'],
    skillCategory: 'test',
    assignedAgentType: 'claude-code',
    filePatterns: ['src/lib/auth/**'],
    effort: 'M',
    dependsOn: [],
    order: 1,
  },
  agentType: 'claude-code',
  testsPassed: true,
  typeErrorCount: 0,
  lintErrorCount: 0,
  filesChanged: 3,
}

describe('POST /api/agents/optimize', () => {
  it('scores work and returns result with drift warnings', async () => {
    const { scoreWork } = await import('@/lib/agents/work-quality')
    const { getDriftWarnings } = await import('@/lib/agents/skill-evolver')

    vi.mocked(scoreWork).mockReturnValue({ score: 0.92, grade: 'A', details: {} } as ReturnType<typeof scoreWork>)
    vi.mocked(getDriftWarnings).mockReturnValue([])

    const { NextRequest } = await import('next/server')
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/optimize', {
      method: 'POST',
      body: JSON.stringify(VALID_OPTIMIZE_BODY),
      headers: { 'Content-Type': 'application/json' },
    }) as InstanceType<typeof NextRequest>

    const res = await POST(req)
    const body = await res.json() as { result: { grade: string }; driftWarnings: unknown[] }

    expect(res.status).toBe(200)
    expect(body.result.grade).toBe('A')
    expect(Array.isArray(body.driftWarnings)).toBe(true)
  })

  it('returns 400 when required fields are missing', async () => {
    const { NextRequest } = await import('next/server')
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/optimize', {
      method: 'POST',
      body: JSON.stringify({ agentType: 'claude-code' }),
      headers: { 'Content-Type': 'application/json' },
    }) as InstanceType<typeof NextRequest>

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/agents/optimize', () => {
  it('returns drift warnings', async () => {
    const { getDriftWarnings } = await import('@/lib/agents/skill-evolver')
    vi.mocked(getDriftWarnings).mockReturnValue([])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { warnings: unknown[] }

    expect(res.status).toBe(200)
    expect(Array.isArray(body.warnings)).toBe(true)
  })
})
