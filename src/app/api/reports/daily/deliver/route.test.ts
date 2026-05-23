import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const deliverMock = vi.fn()

vi.mock('@/lib/reports/daily-report-delivery', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reports/daily-report-delivery')>(
    '@/lib/reports/daily-report-delivery',
  )
  return {
    ...actual,
    deliverDailyReport: deliverMock,
  }
})

vi.mock('@/lib/reports/daily-report', () => ({
  buildDailyReport: vi.fn(() => ({
    version: 1,
    generatedAt: '2026-05-24T08:00:00.000Z',
    period: 'daily',
    markdown: '# Daily',
  })),
}))

vi.mock('@/lib/reports/execute-loop-evidence-store', () => ({
  readExecuteLoopEvidence: vi.fn(() => []),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(() => ({ listByStatus: vi.fn(async () => []) })),
  getDelegationStorageMode: vi.fn(() => 'json'),
  SINGLE_TENANT_USER_ID: 'single-tenant',
}))

vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: vi.fn(() => ({ listAll: vi.fn(async () => []) })),
}))

vi.mock('@/lib/repositories/projectBriefRepository', () => ({
  createProjectBriefRepository: vi.fn(() => ({ listAll: vi.fn(async () => []) })),
}))

vi.mock('@/lib/attention/store', () => ({
  getOpenAttentionItems: vi.fn(() => []),
}))

vi.mock('@/lib/auth/readiness', () => ({
  getAuthReadiness: vi.fn(() => ({
    status: 'ready',
    enabled: true,
    configured: true,
    productionRuntime: false,
    readyForProduction: true,
    nextAction: 'none',
    checks: [],
  })),
}))

function makeRequest(body?: unknown, contentType = 'application/json'): NextRequest {
  return new NextRequest('http://localhost/api/reports/daily/deliver', {
    method: 'POST',
    headers: body !== undefined ? { 'content-type': contentType } : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/reports/daily/deliver', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    deliverMock.mockReset()
    delete process.env.FORGEPILOT_DAILY_REPORT_WEBHOOK_URL
    delete process.env.FORGEPILOT_DAILY_REPORT_WEBHOOK_SECRET
    delete process.env.FORGEPILOT_DAILY_REPORT_WEBHOOK_FORMAT
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns 400 when no target is configured and no override is given', async () => {
    const { POST } = await import('./route')
    const response = await POST(makeRequest())
    expect(response.status).toBe(400)
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/No delivery target/i)
    expect(deliverMock).not.toHaveBeenCalled()
  })

  it('uses env-configured target when no override is provided', async () => {
    process.env.FORGEPILOT_DAILY_REPORT_WEBHOOK_URL = 'https://hooks.example.com/env'
    deliverMock.mockResolvedValueOnce({
      ok: true,
      url: 'https://hooks.example.com/env',
      format: 'json',
      attempts: [{ attempt: 1, status: 200, ok: true }],
      deliveredAt: '2026-05-24T08:00:00.000Z',
    })

    const { POST } = await import('./route')
    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; url: string }
    expect(body.ok).toBe(true)
    expect(body.url).toBe('https://hooks.example.com/env')
    expect(deliverMock).toHaveBeenCalledTimes(1)
    expect(deliverMock.mock.calls[0][1]).toMatchObject({ url: 'https://hooks.example.com/env' })
  })

  it('uses override target from request body and forwards optional secret', async () => {
    deliverMock.mockResolvedValueOnce({
      ok: true,
      url: 'https://hooks.example.com/override',
      format: 'markdown',
      attempts: [{ attempt: 1, status: 200, ok: true }],
      deliveredAt: '2026-05-24T08:00:00.000Z',
      signature: 'sha256=deadbeef',
    })

    const { POST } = await import('./route')
    const response = await POST(
      makeRequest({
        url: 'https://hooks.example.com/override',
        format: 'markdown',
        secret: 'shh',
        maxAttempts: 5,
      }),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { signed: boolean; format: string }
    expect(body.signed).toBe(true)
    expect(body.format).toBe('markdown')
    const [, target, options] = deliverMock.mock.calls[0]
    expect(target).toMatchObject({
      url: 'https://hooks.example.com/override',
      format: 'markdown',
      secret: 'shh',
    })
    expect(options).toMatchObject({ maxAttempts: 5 })
  })

  it('rejects an invalid format value', async () => {
    const { POST } = await import('./route')
    const response = await POST(
      makeRequest({ url: 'https://hooks.example.com/x', format: 'yaml' }),
    )
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/format/i)
    expect(deliverMock).not.toHaveBeenCalled()
  })

  it('returns 502 when delivery fails after retries', async () => {
    process.env.FORGEPILOT_DAILY_REPORT_WEBHOOK_URL = 'https://hooks.example.com/env'
    deliverMock.mockResolvedValueOnce({
      ok: false,
      url: 'https://hooks.example.com/env',
      format: 'json',
      attempts: [
        { attempt: 1, status: 500, ok: false },
        { attempt: 2, status: 500, ok: false },
      ],
      deliveredAt: '2026-05-24T08:00:00.000Z',
    })

    const { POST } = await import('./route')
    const response = await POST(makeRequest())
    expect(response.status).toBe(502)
    const body = (await response.json()) as { ok: boolean; attempts: unknown[] }
    expect(body.ok).toBe(false)
    expect(body.attempts).toHaveLength(2)
  })

  it('returns 400 when JSON body cannot be parsed', async () => {
    const { POST } = await import('./route')
    const response = await POST(makeRequest('not-json{', 'application/json'))
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/Invalid JSON/i)
    expect(deliverMock).not.toHaveBeenCalled()
  })
})
