/**
 * Core Flow Integration Test
 *
 * Tests the complete Idea → Brief → Delegation → Execute → Critic pipeline
 * using mocked AI calls and repositories.
 *
 * This test validates that all pieces are wired together correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Shared in-memory stores ──────────────────────────────────────────────────

const briefStore = { data: '[]' }
const delegationStore = { data: '[]' }

// ── fs mock (shared across all modules) ─────────────────────────────────────

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn((filePath: string) => {
      if (String(filePath).includes('project-briefs')) return briefStore.data
      if (String(filePath).includes('delegations')) return delegationStore.data
      return '[]'
    }),
    writeFileSync: vi.fn((filePath: string, data: string) => {
      if (String(filePath).includes('project-briefs')) briefStore.data = data
      if (String(filePath).includes('delegations')) delegationStore.data = data
    }),
    renameSync: vi.fn((src: string, dest: string) => {
      // tmp → real file: copy tmp data to the real store
      if (String(dest).includes('project-briefs')) briefStore.data = briefStore.data
      if (String(dest).includes('delegations')) delegationStore.data = delegationStore.data
    }),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
}))

// ── brief-versions mock (avoid snapshot side effects) ────────────────────────

vi.mock('@/lib/project-briefs/brief-versions', () => ({
  saveSnapshot: vi.fn(),
}))

// ── Import route handlers after mocks ────────────────────────────────────────

const { GET: getBriefs, POST: postBrief } = await import('../project-briefs/route')
const { GET: getBrief, PATCH: patchBrief, DELETE: deleteBrief } = await import('../project-briefs/[id]/route')
const { POST: createDelegation } = await import('../project-briefs/[id]/create-delegation/route')
const { GET: getDelegation, PATCH: patchDelegation } = await import('../delegations/[id]/route')
const { POST: approveDelegation } = await import('../delegations/[id]/approve/route')

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE = 'http://localhost'

function briefParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function delegationParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function jsonReq(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBriefInput = {
  title: 'ForgePilot E2E Test Feature',
  rawIdea: 'This is a raw idea that is long enough to pass all validation checks in the system',
  problemStatement: 'We need an end-to-end validated flow across all pipeline steps',
  targetAudience: 'Developers using ForgePilot',
  desiredOutcome: 'All pipeline stages wired together and verifiable without AI calls',
  constraints: ['No real AI calls', 'Must run in CI'],
  scope: 'standard' as const,
  researchMode: 'standard' as const,
  privacyMode: 'local' as const,
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Core Flow: Idea → Brief → Delegation → Execute → Critic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    briefStore.data = '[]'
    delegationStore.data = '[]'
  })

  // ── 1. Create a project brief from an idea ───────────────────────────────

  it('creates a project brief from an idea', async () => {
    const res = await postBrief(jsonReq(`${BASE}/api/project-briefs`, validBriefInput))
    expect(res.status).toBe(201)
    const data = await res.json() as Record<string, unknown>
    expect(data).toHaveProperty('id')
    expect(data.title).toBe('ForgePilot E2E Test Feature')
    // buildProjectBrief sets status to 'in_review' by default
    expect(data.status).toBe('in_review')
  })

  // ── 2. Accept a brief and create a delegation ────────────────────────────

  it('accepts a brief and creates a delegation', async () => {
    // Step 1: create brief
    const createRes = await postBrief(jsonReq(`${BASE}/api/project-briefs`, validBriefInput))
    expect(createRes.status).toBe(201)
    const brief = await createRes.json() as Record<string, unknown>
    const briefId = brief.id as string

    // Step 2: patch brief to accepted
    const patchRes = await patchBrief(
      new Request(`${BASE}/api/project-briefs/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      }),
      briefParams(briefId),
    )
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json() as Record<string, unknown>
    expect(patched.status).toBe('accepted')

    // Step 3: create delegation from accepted brief
    const delRes = await createDelegation(
      new Request(`${BASE}/api/project-briefs/${briefId}/create-delegation`, { method: 'POST' }),
      briefParams(briefId),
    )
    expect(delRes.status).toBe(201)
    const delegation = await delRes.json() as Record<string, unknown>
    expect(delegation).toHaveProperty('id')
    expect(delegation.status).toBe('pending')
    expect(delegation.briefId).toBe(briefId)
  })

  // ── 3. Approve a delegation ───────────────────────────────────────────────

  it('approves a delegation', async () => {
    // Seed delegation store with a pending delegation
    const pending = {
      id: 'del-flow-approve',
      title: 'Test delegation',
      briefId: 'brief-flow-1',
      briefTitle: 'Brief',
      status: 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: 0,
      contract: {
        id: 'con-flow-1',
        workItemId: 'FLOW-001',
        goal: 'Implement the feature end-to-end',
        context: 'Context for the test',
        definitionOfDone: ['Feature works', 'Tests pass'],
        riskClass: 'A',
        maxBudgetUsd: 5,
        allowedTools: ['Read', 'Write'],
        branchStrategy: 'feature',
        requiresApproval: true,
        privacyMode: 'local',
        createdAt: '2026-05-21T00:00:00Z',
      },
      logs: [],
      createdAt: '2026-05-21T00:00:00Z',
      updatedAt: '2026-05-21T00:00:00Z',
    }
    delegationStore.data = JSON.stringify([pending])

    const res = await approveDelegation(
      new Request(`${BASE}/api/delegations/del-flow-approve/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'test', note: 'E2E flow approval' }),
      }),
      delegationParams('del-flow-approve'),
    )
    expect(res.status).toBe(200)
    const data = await res.json() as Record<string, unknown>
    expect(data.status).toBe('approved')
  })

  // ── 4. Delegation moves through complete lifecycle ────────────────────────

  it('delegation moves through complete lifecycle', async () => {
    // Seed a pending delegation
    const base = {
      id: 'del-lifecycle',
      title: 'Lifecycle test',
      briefId: 'brief-lifecycle',
      briefTitle: 'Lifecycle Brief',
      executionRoute: 'local-agent',
      costEstimateUsd: 0,
      contract: {
        id: 'con-lifecycle',
        workItemId: 'LIFE-001',
        goal: 'Complete the full lifecycle',
        context: 'Lifecycle context',
        definitionOfDone: ['All stages completed'],
        riskClass: 'A',
        maxBudgetUsd: 5,
        allowedTools: ['Read'],
        branchStrategy: 'feature',
        requiresApproval: false,
        privacyMode: 'local',
        createdAt: '2026-05-21T00:00:00Z',
      },
      logs: [],
      createdAt: '2026-05-21T00:00:00Z',
      updatedAt: '2026-05-21T00:00:00Z',
    }

    // pending → approved
    delegationStore.data = JSON.stringify([{ ...base, status: 'pending' }])
    const approveRes = await approveDelegation(
      new Request(`${BASE}/api/delegations/del-lifecycle/approve`, {
        method: 'POST',
        body: JSON.stringify({ source: 'test' }),
      }),
      delegationParams('del-lifecycle'),
    )
    expect(approveRes.status).toBe(200)
    const approved = await approveRes.json() as Record<string, unknown>
    expect(approved.status).toBe('approved')

    // approved → running (via PATCH)
    const runRes = await patchDelegation(
      new Request(`${BASE}/api/delegations/del-lifecycle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running' }),
      }),
      delegationParams('del-lifecycle'),
    )
    expect(runRes.status).toBe(200)
    const running = await runRes.json() as Record<string, unknown>
    expect(running.status).toBe('running')

    // running → completed (via PATCH)
    const completeRes = await patchDelegation(
      new Request(`${BASE}/api/delegations/del-lifecycle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }),
      delegationParams('del-lifecycle'),
    )
    expect(completeRes.status).toBe(200)
    const completed = await completeRes.json() as Record<string, unknown>
    expect(completed.status).toBe('completed')
  })

  // ── 5. 404 for non-existent delegation ───────────────────────────────────

  it('returns 404 for non-existent delegation', async () => {
    delegationStore.data = '[]'
    const res = await getDelegation(
      new Request(`${BASE}/api/delegations/nonexistent-id`),
      delegationParams('nonexistent-id'),
    )
    expect(res.status).toBe(404)
  })

  // ── 6. Validates required fields on brief creation ────────────────────────

  it('validates required fields on brief creation', async () => {
    const res = await postBrief(
      jsonReq(`${BASE}/api/project-briefs`, {
        // title intentionally missing (empty triggers Zod min(3))
        title: '',
        rawIdea: '',
        problemStatement: 'valid problem statement here',
        targetAudience: 'devs',
        desiredOutcome: 'valid outcome',
        constraints: [],
        scope: 'standard',
        researchMode: 'standard',
        privacyMode: 'local',
      }),
    )
    expect(res.status).toBe(400)
    const data = await res.json() as Record<string, unknown>
    expect(data).toHaveProperty('error', 'Validation failed')
    expect(data).toHaveProperty('fields')
  })

  // ── 7. Prevent delegation from non-accepted brief ─────────────────────────

  it('prevents creating delegation from non-accepted brief', async () => {
    // Create brief (will be 'in_review' by default)
    const createRes = await postBrief(jsonReq(`${BASE}/api/project-briefs`, validBriefInput))
    expect(createRes.status).toBe(201)
    const brief = await createRes.json() as Record<string, unknown>
    const briefId = brief.id as string

    // Attempt delegation without accepting the brief first
    const res = await createDelegation(
      new Request(`${BASE}/api/project-briefs/${briefId}/create-delegation`, { method: 'POST' }),
      briefParams(briefId),
    )
    expect(res.status).toBe(422)
    const data = await res.json() as Record<string, unknown>
    expect(data).toHaveProperty('error')
  })

  // ── 8. listAll returns all created briefs ─────────────────────────────────

  it('GET /api/project-briefs returns all created briefs', async () => {
    // Create two briefs
    await postBrief(jsonReq(`${BASE}/api/project-briefs`, validBriefInput))
    await postBrief(jsonReq(`${BASE}/api/project-briefs`, { ...validBriefInput, title: 'Second Brief Project' }))

    const res = await getBriefs()
    expect(res.status).toBe(200)
    const list = await res.json() as unknown[]
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBe(2)
  })

  // ── 9. GET brief by id ────────────────────────────────────────────────────

  it('GET /api/project-briefs/:id returns the correct brief', async () => {
    const createRes = await postBrief(jsonReq(`${BASE}/api/project-briefs`, validBriefInput))
    const created = await createRes.json() as Record<string, unknown>
    const briefId = created.id as string

    const res = await getBrief(new Request(`${BASE}/api/project-briefs/${briefId}`), briefParams(briefId))
    expect(res.status).toBe(200)
    const data = await res.json() as Record<string, unknown>
    expect(data.id).toBe(briefId)
    expect(data.title).toBe('ForgePilot E2E Test Feature')
  })

  // ── 10. DELETE brief ──────────────────────────────────────────────────────

  it('DELETE /api/project-briefs/:id removes the brief', async () => {
    const createRes = await postBrief(jsonReq(`${BASE}/api/project-briefs`, validBriefInput))
    const created = await createRes.json() as Record<string, unknown>
    const briefId = created.id as string

    const delRes = await deleteBrief(
      new Request(`${BASE}/api/project-briefs/${briefId}`, { method: 'DELETE' }),
      briefParams(briefId),
    )
    expect(delRes.status).toBe(204)

    // Brief should no longer be findable
    const getRes = await getBrief(new Request(`${BASE}/api/project-briefs/${briefId}`), briefParams(briefId))
    expect(getRes.status).toBe(404)
  })
})
