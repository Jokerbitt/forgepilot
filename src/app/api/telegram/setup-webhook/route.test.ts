import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/telegram/config', () => ({
  readTelegramConfig: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

const mockFetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/telegram/setup-webhook', () => {
  it('returns 400 when Telegram not configured', async () => {
    const { readTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue(null as unknown as ReturnType<typeof readTelegramConfig>)

    const { POST } = await import('./route')
    const res = await POST(new NextRequest('http://localhost'))

    expect(res.status).toBe(400)
  })

  it('returns 400 when NEXT_PUBLIC_BASE_URL not set', async () => {
    const { readTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue({ botToken: '123:token', chatId: '-100', enabled: true, notifyOnSeverity: [] } as ReturnType<typeof readTelegramConfig>)
    delete process.env.NEXT_PUBLIC_BASE_URL

    const { POST } = await import('./route')
    const res = await POST(new NextRequest('http://localhost'))

    expect(res.status).toBe(400)
  })

  it('registers webhook and returns ok=true', async () => {
    const { readTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue({ botToken: '123:token', chatId: '-100', enabled: true, notifyOnSeverity: [] } as ReturnType<typeof readTelegramConfig>)
    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com'

    mockFetch.mockResolvedValue({ json: async () => ({ ok: true, description: 'Webhook was set' }) })

    const { POST } = await import('./route')
    const res = await POST(new NextRequest('http://localhost'))
    const body = await res.json() as { ok: boolean; webhookUrl: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.webhookUrl).toContain('/api/telegram/webhook')
  })

  it('returns 502 when Telegram API reports error', async () => {
    const { readTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue({ botToken: '123:token', chatId: '-100', enabled: true, notifyOnSeverity: [] } as ReturnType<typeof readTelegramConfig>)
    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com'

    mockFetch.mockResolvedValue({ json: async () => ({ ok: false, description: 'Bad webhook URL' }) })

    const { POST } = await import('./route')
    const res = await POST(new NextRequest('http://localhost'))

    expect(res.status).toBe(502)
  })
})

describe('GET /api/telegram/setup-webhook', () => {
  it('returns 400 when not configured', async () => {
    const { readTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue(null as unknown as ReturnType<typeof readTelegramConfig>)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost'))

    expect(res.status).toBe(400)
  })

  it('returns webhook info from Telegram', async () => {
    const { readTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue({ botToken: '123:token', chatId: '-100', enabled: true, notifyOnSeverity: [] } as ReturnType<typeof readTelegramConfig>)

    mockFetch.mockResolvedValue({ json: async () => ({ ok: true, result: { url: 'https://example.com/api/telegram/webhook' } }) })

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost'))
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })
})
