import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/telegram/bot', () => ({
  sendTestMessage: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/telegram/test', () => {
  it('returns ok=true when message sent', async () => {
    const { sendTestMessage } = await import('@/lib/telegram/bot')
    vi.mocked(sendTestMessage).mockResolvedValue(true as Awaited<ReturnType<typeof sendTestMessage>>)

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns ok=false when sendTestMessage returns false', async () => {
    const { sendTestMessage } = await import('@/lib/telegram/bot')
    vi.mocked(sendTestMessage).mockResolvedValue(false as Awaited<ReturnType<typeof sendTestMessage>>)

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(false)
  })

  it('returns 500 when sendTestMessage throws', async () => {
    const { sendTestMessage } = await import('@/lib/telegram/bot')
    vi.mocked(sendTestMessage).mockRejectedValue(new Error('Bot not configured'))

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { ok: boolean; error: string }

    expect(res.status).toBe(500)
    expect(body.ok).toBe(false)
  })
})
