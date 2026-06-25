/**
 * Execute route — API integration tests
 *
 * Tests the actual POST handler behavior: auth, 404, execution mode routing.
 * Pure function tests (prompt builder, guards) live in route.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn().mockImplementation(() => { throw new Error('claude not found') }),
  execFile: vi.fn(),
}))
// Pin Ollama as unreachable so execution-mode routing is deterministic regardless
// of whether the test machine happens to have a local Ollama running. The route
// now falls back to the Ollama agent when no cloud provider is available, so a
// real reachable Ollama would otherwise turn the "simulation" path into
// "ollama-agent". The fallback routing itself is unit-tested in execution-mode.test.ts.
vi.mock('@/lib/agent-runner/ollama-runner', () => ({
  OllamaAgentRunner: vi.fn(),
  isOllamaReachable: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn().mockReturnValue({}),
}))
vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(),
  SINGLE_TENANT_USER_ID: 'default',
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  buildRateLimitHeaders: vi.fn().mockReturnValue({}),
}))
vi.mock('@/lib/logger', () => {
  const childLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() }
  childLogger.child.mockReturnValue(childLogger)
  const base = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnValue(childLogger) }
  return {
    logger: base,
    aiLogger: base,
    apiLogger: base,
    delegationLogger: base,
    evalLogger: base,
    dsgvoLogger: base,
  }
})
vi.mock('@/lib/tracing/tracer', () => ({
  withSpan: vi.fn().mockImplementation((_name: string, _attrs: unknown, fn: () => Promise<void>) => fn()),
}))
vi.mock('@/lib/knowledge/context-package', () => ({
  buildContextPackage: vi.fn().mockResolvedValue({ cards: [] }),
}))
vi.mock('@/lib/budget/guard', () => ({
  wouldExceedBudget: vi.fn().mockReturnValue(false),
  checkBudget: vi.fn().mockResolvedValue(null),
}))

import { requireAuth } from '@/lib/auth/require-auth'
import { createDelegationRepository } from '@/lib/repositories/delegationRepository'
import type { Delegation } from '@/lib/models/delegation'

const mockRequireAuth = vi.mocked(requireAuth)
const mockCreateRepo = vi.mocked(createDelegationRepository)

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Add dark mode',
    status: 'approved',
    executionRoute: 'runner',
    costEstimateUsd: 0.5,
    autoOrchestrate: false,
    contract: {
      id: 'con-1',
      workItemId: 'JOK-1',
      goal: 'Implement dark mode toggle',
      context: 'Settings page needs a toggle',
      definitionOfDone: ['Toggle visible', 'Mode persists'],
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read_file', 'write_file'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-01-01T00:00:00Z',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/delegations/${id}/execute`, { method: 'POST' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue(null)
})

describe('POST /api/delegations/[id]/execute', () => {
  it('returns 404 when delegation is not found', async () => {
    mockCreateRepo.mockReturnValue({
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const res = await POST(makeRequest('not-found'), { params: Promise.resolve({ id: 'not-found' }) })

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('nicht gefunden')
  })

  it('returns 400 when delegation is not approved', async () => {
    const delegation = makeDelegation({ status: 'pending' })
    mockCreateRepo.mockReturnValue({
      findById: vi.fn().mockResolvedValue(delegation),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-1'), { params: Promise.resolve({ id: 'del-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('pending')
  })

  it('starts simulation mode and returns 200 when no CLI, API key, or Ollama is available', async () => {
    const delegation = makeDelegation()
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(delegation),
      update: vi.fn().mockImplementation(async (id: string, patch: Partial<Delegation>) => ({
        ...delegation,
        ...patch,
        id,
      })),
    }
    mockCreateRepo.mockReturnValue(mockRepo as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-1'), { params: Promise.resolve({ id: 'del-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json() as { started: boolean; mode: string; delegationId: string }
    expect(body.started).toBe(true)
    expect(body.mode).toBe('simulation')
    expect(body.delegationId).toBe('del-1')
  })

  it('returns 401 when not authenticated', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    )

    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-1'), { params: Promise.resolve({ id: 'del-1' }) })

    expect(res.status).toBe(401)
  })

  it('returns 400 when runner mode has no definition of done', async () => {
    const delegation = makeDelegation({
      executionRoute: 'runner',
      contract: { ...makeDelegation().contract, definitionOfDone: [] },
    })
    mockCreateRepo.mockReturnValue({
      findById: vi.fn().mockResolvedValue(delegation),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-1'), { params: Promise.resolve({ id: 'del-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Definition of Done')
  })
})
