import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/telegram/bot', () => ({
  sendTelegramMessage: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/telegram/send', () => {
  it('sends a message and returns ok=true', async () => {
    const { sendTelegramMessage } = await import('@/lib/telegram/bot')
    vi.mocked(sendTelegramMessage).mockResolvedValue(true)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/telegram/send', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello from ForgePilot' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(vi.mocked(sendTelegramMessage)).toHaveBeenCalledWith(
      'Hello from ForgePilot',
      expect.objectContaining({ parseMode: 'Markdown' }),
    )
  })

  it('returns 400 when text is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/telegram/send', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when sendTelegramMessage throws', async () => {
    const { sendTelegramMessage } = await import('@/lib/telegram/bot')
    vi.mocked(sendTelegramMessage).mockRejectedValue(new Error('Bot API error'))

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/telegram/send', {
      method: 'POST',
      body: JSON.stringify({ text: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
