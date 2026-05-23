import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/cron/auth', () => ({
  isCronAuthorized: vi.fn(),
}))
vi.mock('@/lib/telegram/config', () => ({
  isTelegramEnabled: vi.fn(),
  readTelegramConfig: vi.fn(),
}))
vi.mock('@/lib/telegram/bot', () => ({
  sendTelegramMessage: vi.fn(),
}))
vi.mock('@/lib/digest/digest-builder', () => ({
  buildDigest: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/cron/telegram-digest', () => {
  it('returns 401 when not authorized', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    vi.mocked(isCronAuthorized).mockReturnValue(false)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/telegram-digest'))
    expect(res.status).toBe(401)
  })

  it('returns skipped when Telegram is not enabled', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    const { isTelegramEnabled } = await import('@/lib/telegram/config')

    vi.mocked(isCronAuthorized).mockReturnValue(true)
    vi.mocked(isTelegramEnabled).mockReturnValue(false)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/telegram-digest'))
    const body = await res.json() as { ok: boolean; skipped: boolean }

    expect(res.status).toBe(200)
    expect(body.skipped).toBe(true)
  })

  it('sends digest and returns ok=true', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    const { isTelegramEnabled, readTelegramConfig } = await import('@/lib/telegram/config')
    const { buildDigest } = await import('@/lib/digest/digest-builder')
    const { sendTelegramMessage } = await import('@/lib/telegram/bot')

    vi.mocked(isCronAuthorized).mockReturnValue(true)
    vi.mocked(isTelegramEnabled).mockReturnValue(true)
    vi.mocked(readTelegramConfig).mockReturnValue({ chatId: '123', botToken: 'tok' } as ReturnType<typeof readTelegramConfig>)
    vi.mocked(buildDigest).mockReturnValue({
      stats: {
        totalNotifications: 5, unreadNotifications: 2, criticalNotifications: 0,
        completedDelegations: 3, failedDelegations: 0, runningDelegations: 1,
        completedRuns: 3, failedRuns: 0, totalRunCostUsd: 0.05,
      },
      sections: [],
    } as unknown as ReturnType<typeof buildDigest>)
    vi.mocked(sendTelegramMessage).mockResolvedValue(true)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/telegram-digest'))
    const body = await res.json() as { ok: boolean; period: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.period).toBe('daily')
  })

  it('returns 500 when sendTelegramMessage throws', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    const { isTelegramEnabled, readTelegramConfig } = await import('@/lib/telegram/config')
    const { buildDigest } = await import('@/lib/digest/digest-builder')
    const { sendTelegramMessage } = await import('@/lib/telegram/bot')

    vi.mocked(isCronAuthorized).mockReturnValue(true)
    vi.mocked(isTelegramEnabled).mockReturnValue(true)
    vi.mocked(readTelegramConfig).mockReturnValue({ chatId: '123', botToken: 'tok' } as ReturnType<typeof readTelegramConfig>)
    vi.mocked(buildDigest).mockReturnValue({ stats: { totalNotifications: 0, unreadNotifications: 0, criticalNotifications: 0, completedDelegations: 0, failedDelegations: 0, runningDelegations: 0, completedRuns: 0, failedRuns: 0, totalRunCostUsd: 0 }, sections: [] } as unknown as ReturnType<typeof buildDigest>)
    vi.mocked(sendTelegramMessage).mockRejectedValue(new Error('Telegram API error'))

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/telegram-digest'))
    expect(res.status).toBe(500)
  })
})
