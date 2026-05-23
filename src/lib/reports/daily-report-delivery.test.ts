import { describe, expect, it, vi, type MockedFunction } from 'vitest'
import { createHmac } from 'crypto'
import type { DailyReport } from './daily-report'
import {
  deliverDailyReport,
  readDailyReportDeliveryTargetFromEnv,
} from './daily-report-delivery'

function makeReport(overrides: Partial<DailyReport> = {}): DailyReport {
  const base = {
    version: 1,
    generatedAt: '2026-05-24T08:00:00.000Z',
    period: 'daily',
    markdown: '# ForgePilot Daily Report\n\nplain prefix sk-secret1234567890abcdefghij tail\n',
    ...overrides,
  }
  return base as unknown as DailyReport
}

function jsonResponse(status: number): Response {
  return new Response('{}', { status, headers: { 'content-type': 'application/json' } })
}

function mockFetch(impl?: (url: string) => Promise<Response>): MockedFunction<typeof fetch> {
  const fn = vi.fn(impl ?? (async () => jsonResponse(200))) as unknown as MockedFunction<typeof fetch>
  return fn
}

function getCallInit(fn: MockedFunction<typeof fetch>, callIndex = 0): RequestInit {
  const call = fn.mock.calls[callIndex]
  if (!call) throw new Error('fetch was not called')
  const init = call[1]
  if (!init) throw new Error('fetch was called without init')
  return init
}

describe('deliverDailyReport', () => {
  it('rejects relative URLs', async () => {
    await expect(
      deliverDailyReport(makeReport(), { url: '/not-absolute' }),
    ).rejects.toThrow(/absolute http/i)
  })

  it('posts JSON payload with scrubbed markdown on first success', async () => {
    const fetchImpl = mockFetch()
    const result = await deliverDailyReport(
      makeReport(),
      { url: 'https://example.test/webhook' },
      { fetchImpl },
    )

    expect(result.ok).toBe(true)
    expect(result.attempts).toHaveLength(1)
    expect(result.format).toBe('json')
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const init = getCallInit(fetchImpl)
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['content-type']).toContain('application/json')
    const body = JSON.parse(init.body as string) as DailyReport
    expect(body.markdown).not.toContain('sk-secret1234567890abcdefghij')
    expect(body.markdown).toContain('[API_KEY_REDACTED]')
  })

  it('posts scrubbed markdown body when format=markdown', async () => {
    const fetchImpl = mockFetch()
    await deliverDailyReport(
      makeReport(),
      { url: 'https://example.test/webhook', format: 'markdown' },
      { fetchImpl },
    )

    const init = getCallInit(fetchImpl)
    const headers = init.headers as Record<string, string>
    expect(headers['content-type']).toContain('text/markdown')
    expect(init.body as string).toContain('[API_KEY_REDACTED]')
    expect(init.body as string).not.toContain('sk-secret1234567890abcdefghij')
  })

  it('signs the payload with HMAC-SHA256 when secret is provided', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(204))
    const secret = 'shared-secret'
    const result = await deliverDailyReport(
      makeReport(),
      { url: 'https://example.test/webhook', secret, format: 'markdown' },
      { fetchImpl },
    )

    expect(result.signature).toBeDefined()
    const init = getCallInit(fetchImpl)
    const headers = init.headers as Record<string, string>
    const signature = headers['x-forgepilot-signature']
    expect(signature).toMatch(/^sha256=[a-f0-9]+$/)
    const expected = `sha256=${createHmac('sha256', secret).update(init.body as string, 'utf8').digest('hex')}`
    expect(signature).toBe(expected)
  })

  it('retries on transient failure and reports each attempt', async () => {
    let call = 0
    const fetchImpl = mockFetch(async () => {
      call += 1
      return jsonResponse(call === 1 ? 502 : 200)
    })
    const sleep = vi.fn(async () => undefined)

    const result = await deliverDailyReport(
      makeReport(),
      { url: 'https://example.test/webhook' },
      {
        fetchImpl,
        sleep,
        maxAttempts: 3,
        retryDelayMs: 10,
      },
    )

    expect(result.ok).toBe(true)
    expect(result.attempts).toHaveLength(2)
    expect(result.attempts[0]).toMatchObject({ attempt: 1, status: 502, ok: false })
    expect(result.attempts[1]).toMatchObject({ attempt: 2, status: 200, ok: true })
    expect(sleep).toHaveBeenCalledWith(10)
  })

  it('captures thrown errors and returns ok=false when retries are exhausted', async () => {
    const fetchImpl = mockFetch(async () => {
      throw new Error('network down')
    })
    const sleep = vi.fn(async () => undefined)

    const result = await deliverDailyReport(
      makeReport(),
      { url: 'https://example.test/webhook' },
      {
        fetchImpl,
        sleep,
        maxAttempts: 2,
        retryDelayMs: 5,
      },
    )

    expect(result.ok).toBe(false)
    expect(result.attempts).toHaveLength(2)
    expect(result.attempts.every(a => a.ok === false)).toBe(true)
    expect(result.attempts[0].error).toContain('network down')
  })

  it('merges custom headers and preserves user-agent', async () => {
    const fetchImpl = mockFetch()
    await deliverDailyReport(
      makeReport(),
      {
        url: 'https://example.test/webhook',
        headers: { 'x-extra': 'value', 'user-agent': 'override' },
      },
      { fetchImpl },
    )

    const init = getCallInit(fetchImpl)
    const headers = init.headers as Record<string, string>
    expect(headers['x-extra']).toBe('value')
    expect(headers['user-agent']).toBe('override')
  })
})

describe('readDailyReportDeliveryTargetFromEnv', () => {
  it('returns configured=false when URL is missing', () => {
    expect(readDailyReportDeliveryTargetFromEnv({} as NodeJS.ProcessEnv).configured).toBe(false)
  })

  it('returns a json target by default', () => {
    const result = readDailyReportDeliveryTargetFromEnv({
      FORGEPILOT_DAILY_REPORT_WEBHOOK_URL: 'https://hooks.example.com/x',
    } as unknown as NodeJS.ProcessEnv)
    expect(result.configured).toBe(true)
    expect(result.target?.format).toBe('json')
    expect(result.target?.url).toBe('https://hooks.example.com/x')
    expect(result.target?.secret).toBeUndefined()
  })

  it('honours markdown format and HMAC secret env vars', () => {
    const result = readDailyReportDeliveryTargetFromEnv({
      FORGEPILOT_DAILY_REPORT_WEBHOOK_URL: 'https://hooks.example.com/x',
      FORGEPILOT_DAILY_REPORT_WEBHOOK_FORMAT: 'markdown',
      FORGEPILOT_DAILY_REPORT_WEBHOOK_SECRET: 'top-secret',
    } as unknown as NodeJS.ProcessEnv)
    expect(result.target?.format).toBe('markdown')
    expect(result.target?.secret).toBe('top-secret')
  })

  it('falls back to json for unknown format strings', () => {
    const result = readDailyReportDeliveryTargetFromEnv({
      FORGEPILOT_DAILY_REPORT_WEBHOOK_URL: 'https://hooks.example.com/x',
      FORGEPILOT_DAILY_REPORT_WEBHOOK_FORMAT: 'yaml',
    } as unknown as NodeJS.ProcessEnv)
    expect(result.target?.format).toBe('json')
  })
})
