import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/telegram/commands', () => ({
  handleTelegramUpdate: vi.fn(),
  handleCallbackQuery: vi.fn(),
}))
vi.mock('@/lib/telegram/bot', () => ({
  sendTelegramMessage: vi.fn(),
  answerCallbackQuery: vi.fn(),
  editMessageText: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.TELEGRAM_WEBHOOK_SECRET
})

describe('POST /api/telegram/webhook', () => {
  it('processes text update and returns ok=true', async () => {
    const { handleTelegramUpdate } = await import('@/lib/telegram/commands')
    const { sendTelegramMessage } = await import('@/lib/telegram/bot')

    vi.mocked(handleTelegramUpdate).mockResolvedValue({ chatId: 123, text: 'Hello back' } as unknown as Awaited<ReturnType<typeof handleTelegramUpdate>>)
    vi.mocked(sendTelegramMessage).mockResolvedValue(true)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ update_id: 1, message: { text: '/status', chat: { id: 123 } } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns 403 when secret header is wrong', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'correct-secret'

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ update_id: 1 }),
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
      },
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
  })

  it('returns 200 even when handler throws (Telegram requires 200)', async () => {
    const { handleTelegramUpdate } = await import('@/lib/telegram/commands')
    vi.mocked(handleTelegramUpdate).mockRejectedValue(new Error('Handler error'))

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ update_id: 1, message: { text: '/crash' } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
  })
})
