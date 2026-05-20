import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const fetchMock = vi.fn(() => Promise.resolve(new Response('ok')))
vi.stubGlobal('fetch', fetchMock)

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function callPost(body: unknown) {
  const { POST } = await import('./route')
  return POST(new Request('http://localhost/api/sentry/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as import('next/server').NextRequest)
}

const ISSUE_PAYLOAD = {
  action: 'created',
  data: {
    issue: {
      id: '123',
      title: 'TypeError: Cannot read property of undefined',
      culprit: 'src/app/api/delegations/route.ts',
      level: 'error',
      count: '5',
      permalink: 'https://privat-0p.sentry.io/issues/123/',
    },
  },
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/sentry/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID   = '12345'
  })

  it('returns 200 for valid created payload', async () => {
    const res = await callPost(ISSUE_PAYLOAD)
    expect(res.status).toBe(200)
    const data = await res.json() as { ok: boolean }
    expect(data.ok).toBe(true)
  })

  it('sends Telegram message for created action', async () => {
    await callPost(ISSUE_PAYLOAD)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('does NOT send Telegram for resolved action', async () => {
    await callPost({ ...ISSUE_PAYLOAD, action: 'resolved' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does NOT send Telegram when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    await callPost(ISSUE_PAYLOAD)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost/api/sentry/webhook', {
      method: 'POST',
      body: 'not-json',
    }) as import('next/server').NextRequest)
    expect(res.status).toBe(400)
  })

  it('Telegram message contains issue title', async () => {
    await callPost(ISSUE_PAYLOAD)
    const call = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    const body = JSON.parse(call[1].body) as { text: string }
    expect(body.text).toContain('TypeError: Cannot read property of undefined')
  })

  it('Telegram message contains Sentry link', async () => {
    await callPost(ISSUE_PAYLOAD)
    const call = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    const body = JSON.parse(call[1].body) as { text: string }
    expect(body.text).toContain('sentry.io/issues/123')
  })
})

describe('GET /api/sentry/webhook', () => {
  it('returns ok for Sentry verification ping', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json() as { ok: boolean; service: string }
    expect(data.ok).toBe(true)
    expect(data.service).toBe('forgepilot-sentry-webhook')
  })
})
