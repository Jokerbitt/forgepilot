/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/create-pr
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoFindById = vi.fn<(a: string) => Promise<Delegation | null>>()
const repoUpdate   = vi.fn<(a: string, b: Partial<Delegation>) => Promise<Delegation | null>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ findById: repoFindById, update: repoUpdate })),
}))

// ── GitHub PR mock ─────────────────────────────────────────────────────────────

const createGitHubPR = vi.fn<(a: unknown) => Promise<{ url: string; number: number; status: string }>>()

vi.mock('@/lib/github/pr-creator', () => ({ createGitHubPR }))

// ── AI text generation mock ────────────────────────────────────────────────────

vi.mock('@/lib/ai/text-generation', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'Generated PR body' }),
}))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'My Feature',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.10,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    contract: {
      id: 'con-001',
      workItemId: 'FP-123',
      goal: 'Implement feature X',
      context: 'ctx',
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      definitionOfDone: ['Tests pass'],
      createdAt: '2026-05-01T10:00:00.000Z',
    },
    ...overrides,
  }
}

function makeRequest(id: string, body: Record<string, unknown> = {}) {
  return new Request(`http://localhost/api/delegations/${id}/create-pr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delegations/[id]/create-pr', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when delegation not found', async () => {
    repoFindById.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('missing'), makeParams('missing'))
    expect(res.status).toBe(404)
    expect(createGitHubPR).not.toHaveBeenCalled()
  })

  it('returns 400 when delegation is not completed', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ status: 'running' }))
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(400)
    expect(createGitHubPR).not.toHaveBeenCalled()
  })

  it('creates PR and returns prUrl and prNumber', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    createGitHubPR.mockResolvedValueOnce({
      url: 'https://github.com/owner/repo/pull/42',
      number: 42,
      status: 'created',
    })
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(200)
    const body = await res.json() as { prUrl: string; prNumber: number; status: string }
    expect(body.prUrl).toBe('https://github.com/owner/repo/pull/42')
    expect(body.prNumber).toBe(42)
    expect(body.status).toBe('created')
  })

  it('persists PR URL in delegation after creating PR', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    createGitHubPR.mockResolvedValueOnce({
      url: 'https://github.com/owner/repo/pull/99',
      number: 99,
      status: 'created',
    })
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(repoUpdate).toHaveBeenCalledWith(
      'del-001',
      expect.objectContaining({
        summaryReport: expect.objectContaining({
          prUrl: 'https://github.com/owner/repo/pull/99',
        }),
      }),
    )
  })

  it('uses custom branch from request body', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    createGitHubPR.mockResolvedValueOnce({
      url: 'https://github.com/owner/repo/pull/5',
      number: 5,
      status: 'created',
    })
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    await POST(makeRequest('del-001', { branch: 'my-custom-branch' }), makeParams('del-001'))
    const prArg = createGitHubPR.mock.calls[0]?.[0] as { branch: string }
    expect(prArg.branch).toBe('my-custom-branch')
  })

  it('derives branch name from workItemId when no branch override', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    createGitHubPR.mockResolvedValueOnce({ url: 'https://github.com/x/y/pull/1', number: 1, status: 'created' })
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    await POST(makeRequest('del-001'), makeParams('del-001'))
    const prArg = createGitHubPR.mock.calls[0]?.[0] as { branch: string }
    expect(prArg.branch).toContain('fp-123')
  })
})
