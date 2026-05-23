import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/telegram/config', () => ({
  readTelegramConfig: vi.fn(),
  writeTelegramConfig: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/telegram/config', () => {
  it('returns masked config when configured', async () => {
    const { readTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue({
      botToken: '123456:ABCDEFGabcdef',
      chatId: '-100123456',
      enabled: true,
      notifyOnSeverity: ['warning', 'critical'],
    } as ReturnType<typeof readTelegramConfig>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { configured: boolean; botToken: string; chatId: string }

    expect(res.status).toBe(200)
    expect(body.configured).toBe(true)
    expect(body.chatId).toBe('-100123456')
    expect(body.botToken).not.toContain('ABCDEFGabcdef')
  })

  it('returns unconfigured defaults when no config', async () => {
    const { readTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue(null as unknown as ReturnType<typeof readTelegramConfig>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { configured: boolean }

    expect(res.status).toBe(200)
    expect(body.configured).toBe(false)
  })
})

describe('POST /api/telegram/config', () => {
  it('saves config and returns ok=true', async () => {
    const { readTelegramConfig, writeTelegramConfig } = await import('@/lib/telegram/config')
    vi.mocked(readTelegramConfig).mockReturnValue(null as unknown as ReturnType<typeof readTelegramConfig>)
    vi.mocked(writeTelegramConfig).mockReturnValue(undefined)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/telegram/config', {
      method: 'POST',
      body: JSON.stringify({ botToken: '123456:newtoken', chatId: '-999', enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns 400 when body is malformed JSON', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/telegram/config', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
