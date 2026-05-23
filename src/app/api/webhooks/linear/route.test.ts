import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/linear/webhook-parser', () => ({
  parseLinearWebhook: vi.fn(),
  verifyLinearSignature: vi.fn(),
}))
vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(),
  SINGLE_TENANT_USER_ID: 'default',
}))
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/webhooks/linear', () => {
  it('returns 401 when signature is invalid', async () => {
    const { verifyLinearSignature } = await import('@/lib/linear/webhook-parser')
    vi.mocked(verifyLinearSignature).mockReturnValue(false)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'Issue', action: 'create' }),
      headers: { 'Content-Type': 'application/json', 'linear-signature': 'bad' },
    })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('ignores webhooks that parse as action=ignore', async () => {
    const { verifyLinearSignature, parseLinearWebhook } = await import('@/lib/linear/webhook-parser')
    vi.mocked(verifyLinearSignature).mockReturnValue(true)
    vi.mocked(parseLinearWebhook).mockReturnValue({ action: 'ignore', reason: 'Not a relevant event' } as ReturnType<typeof parseLinearWebhook>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'Comment' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean; action: string }

    expect(res.status).toBe(200)
    expect(body.action).toBe('ignored')
  })

  it('skips duplicate delegation', async () => {
    const { verifyLinearSignature, parseLinearWebhook } = await import('@/lib/linear/webhook-parser')
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')

    vi.mocked(verifyLinearSignature).mockReturnValue(true)
    vi.mocked(parseLinearWebhook).mockReturnValue({
      action: 'create-delegation',
      candidate: {
        workItemId: 'FP-200', title: 'Fix bug', goal: 'Fix the bug', context: 'Auth module',
        riskClass: 'A', maxBudgetUsd: 1, priority: 2, branchStrategy: 'feature', requiresApproval: false,
        linearUrl: 'https://linear.app/example/issue/FP-200', labels: [],
      },
    })
    vi.mocked(createDelegationRepository).mockReturnValue({
      listByStatus: vi.fn().mockResolvedValue([{
        id: 'del-existing', status: 'pending',
        contract: { workItemId: 'FP-200' },
      }]),
      create: vi.fn(),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'Issue' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean; action: string }

    expect(res.status).toBe(200)
    expect(body.action).toBe('skipped')
  })

  it('creates delegation and returns 201', async () => {
    const { verifyLinearSignature, parseLinearWebhook } = await import('@/lib/linear/webhook-parser')
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')

    vi.mocked(verifyLinearSignature).mockReturnValue(true)
    vi.mocked(parseLinearWebhook).mockReturnValue({
      action: 'create-delegation',
      candidate: {
        workItemId: 'FP-300', title: 'New feature', goal: 'Build feature', context: 'Context',
        riskClass: 'A', maxBudgetUsd: 1, priority: 2, branchStrategy: 'feature', requiresApproval: false,
        linearUrl: 'https://linear.app/example/issue/FP-300', labels: [],
      },
    })
    vi.mocked(createDelegationRepository).mockReturnValue({
      listByStatus: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'del-new', status: 'approved', contract: { workItemId: 'FP-300' } }),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'Issue' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean; action: string; delegationId: string }

    expect(res.status).toBe(201)
    expect(body.action).toBe('delegation-created')
    expect(body.delegationId).toBe('del-new')
  })
})

describe('GET /api/webhooks/linear', () => {
  it('returns service info', async () => {
    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
