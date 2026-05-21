/**
 * M104 — Integration Test Suite
 *
 * End-to-end flow:
 *   POST /api/project-briefs  →  GET /api/project-briefs/[id]
 *   →  POST /api/delegations  →  GET /api/delegations/[id]
 *
 * Uses in-memory mocked fs so no real config files are touched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── In-memory store ──────────────────────────────────────────────────────────
const store: Record<string, string> = {}

const fsMock = {
  existsSync: (p: string) => p in store,
  readFileSync: (p: string) => {
    if (p in store) return store[p]
    throw new Error(`ENOENT: no such file '${p}'`)
  },
  writeFileSync: (p: string, data: string) => { store[p] = data },
  // Atomic write pattern: renameSync(tmp, dest) moves the tmp file into place
  renameSync: (src: string, dest: string) => {
    if (src in store) {
      store[dest] = store[src]
      delete store[src]
    }
  },
  mkdirSync: vi.fn(),
}

vi.mock('fs', () => ({ default: fsMock, ...fsMock }))

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function jsonBody<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>
}

// ─── Flow 1: Project Brief Pipeline ──────────────────────────────────────────
describe('M104 — Project Brief Pipeline', () => {
  beforeEach(() => {
    // Reset in-memory stores before each test
    for (const key of Object.keys(store)) delete store[key]
    vi.resetModules()
  })

  it('creates a project brief (POST) and retrieves it (GET /[id])', async () => {
    const { POST } = await import('@/app/api/project-briefs/route')

    const req = makeRequest({
      title: 'Autonomous Test Feature',
      rawIdea: 'Build a feature that automatically tests the integration pipeline.',
      problemStatement: 'Manual integration testing is slow and error-prone.',
      targetAudience: 'Developers',
      desiredOutcome: 'Reliable, automated integration tests with >90% coverage.',
      scope: 'standard',
      researchMode: 'quick',
      privacyMode: 'local',
      constraints: [],
    })

    const createRes = await POST(req)
    expect(createRes.status).toBe(201)
    const brief = await jsonBody<{ id: string; title: string; status: string }>(createRes)
    expect(brief.id).toBeTruthy()
    expect(brief.title).toBe('Autonomous Test Feature')

    // Now retrieve by ID
    const { GET } = await import('@/app/api/project-briefs/[id]/route')
    const getRes = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: brief.id }) })
    expect(getRes.status).toBe(200)
    const fetched = await jsonBody<{ id: string; title: string }>(getRes)
    expect(fetched.id).toBe(brief.id)
    expect(fetched.title).toBe('Autonomous Test Feature')
  })

  it('returns 404 for unknown project brief id', async () => {
    vi.resetModules()
    const { GET } = await import('@/app/api/project-briefs/[id]/route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'non-existent-id' }) })
    expect(res.status).toBe(404)
  })

  it('rejects invalid project brief body with 400', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/project-briefs/route')
    const req = makeRequest({ title: 'x' }) // missing required fields
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await jsonBody<{ error: string }>(res)
    expect(body.error).toBeTruthy()
  })
})

// ─── Flow 2: Delegation Pipeline ─────────────────────────────────────────────
describe('M104 — Delegation Pipeline', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    vi.resetModules()
  })

  it('creates a delegation (POST) and retrieves it (GET /[id])', async () => {
    const { POST } = await import('@/app/api/delegations/route')

    const req = makeRequest({
      id: 'del-integration-test-1',
      title: 'Build auth module',
      status: 'pending',
      contract: {
        goal: 'Implement JWT authentication for the API',
        riskClass: 'A',
        privacyMode: 'local',
        requiresApproval: false,
      },
    })

    const createRes = await POST(req)
    expect([200, 201]).toContain(createRes.status)
    const delegation = await jsonBody<{ id: string; title: string; status: string }>(createRes)
    expect(delegation.id).toBe('del-integration-test-1')
    expect(delegation.status).toBe('approved') // Risk-A auto-approved

    // Retrieve by ID
    const { GET } = await import('@/app/api/delegations/[id]/route')
    const getRes = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'del-integration-test-1' }) })
    expect(getRes.status).toBe(200)
    const fetched = await jsonBody<{ id: string; status: string }>(getRes)
    expect(fetched.id).toBe('del-integration-test-1')
    expect(fetched.status).toBe('approved')
  })

  it('auto-approves Risk-A delegations without requiresApproval flag', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/delegations/route')

    const req = makeRequest({
      id: 'del-risk-a-auto',
      title: 'Low risk task',
      status: 'pending',
      contract: {
        goal: 'Run automated code formatting across the codebase',
        riskClass: 'A',
        privacyMode: 'local',
        requiresApproval: false,
      },
    })

    const res = await POST(req)
    const d = await jsonBody<{ status: string }>(res)
    expect(d.status).toBe('approved')
  })

  it('keeps Risk-B delegation in pending when requiresApproval is true', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/delegations/route')

    const req = makeRequest({
      id: 'del-risk-b-manual',
      title: 'Database migration',
      status: 'pending',
      contract: {
        goal: 'Migrate the user table to add a new column',
        riskClass: 'B',
        privacyMode: 'local',
        requiresApproval: true,
      },
    })

    const res = await POST(req)
    const d = await jsonBody<{ status: string }>(res)
    expect(d.status).toBe('pending') // NOT auto-approved
  })

  it('returns 404 for unknown delegation id', async () => {
    vi.resetModules()
    const { GET } = await import('@/app/api/delegations/[id]/route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'does-not-exist' }) })
    expect(res.status).toBe(404)
  })

  it('rejects delegation with missing contract goal', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/delegations/route')

    const req = makeRequest({
      id: 'del-invalid',
      title: 'Bad delegation',
      status: 'pending',
      contract: {
        // goal is missing
        riskClass: 'A',
        privacyMode: 'local',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ─── Flow 3: Full End-to-End Brief → Delegation ───────────────────────────────
describe('M104 — End-to-End Brief → Delegation Flow', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    vi.resetModules()
  })

  it('creates brief, then creates delegation referencing the brief id', async () => {
    // Step 1: Create a project brief
    const { POST: postBrief } = await import('@/app/api/project-briefs/route')
    const briefReq = makeRequest({
      title: 'API Rate Limiter',
      rawIdea: 'Add rate limiting to all public API endpoints to prevent abuse.',
      problemStatement: 'Public endpoints are vulnerable to abuse without rate limiting.',
      targetAudience: 'API consumers',
      desiredOutcome: 'All endpoints return 429 after exceeding rate limit threshold.',
      scope: 'minimal',
      researchMode: 'quick',
      privacyMode: 'local',
      constraints: ['Use in-memory sliding window', 'No Redis dependency'],
    })

    const briefRes = await postBrief(briefReq)
    expect(briefRes.status).toBe(201)
    const brief = await jsonBody<{ id: string }>(briefRes)
    const briefId = brief.id

    // Step 2: Create a delegation that references the brief
    vi.resetModules()
    const { POST: postDelegation } = await import('@/app/api/delegations/route')
    const delReq = makeRequest({
      id: `del-from-brief-${briefId}`,
      title: 'Implement rate limiter from brief',
      status: 'pending',
      contract: {
        goal: `Implement rate limiting as specified in brief ${briefId}`,
        riskClass: 'A',
        privacyMode: 'local',
        requiresApproval: false,
        context: `ProjectBrief:${briefId}`,
      },
    })

    const delRes = await postDelegation(delReq)
    expect([200, 201]).toContain(delRes.status)
    const delegation = await jsonBody<{ id: string; status: string; contract: { context: string } }>(delRes)
    expect(delegation.status).toBe('approved')
    expect(delegation.contract.context).toContain(briefId)

    // Step 3: Verify both are retrievable
    vi.resetModules()
    const { GET: getBrief } = await import('@/app/api/project-briefs/[id]/route')
    const briefCheck = await getBrief(new Request('http://localhost'), { params: Promise.resolve({ id: briefId }) })
    expect(briefCheck.status).toBe(200)

    vi.resetModules()
    const { GET: getDelegation } = await import('@/app/api/delegations/[id]/route')
    const delCheck = await getDelegation(new Request('http://localhost'), { params: Promise.resolve({ id: delegation.id }) })
    expect(delCheck.status).toBe(200)
  })
})
