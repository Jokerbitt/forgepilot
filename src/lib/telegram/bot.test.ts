import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/telegram/config', () => ({
  readTelegramConfig: vi.fn(() => null),
  isTelegramEnabled: vi.fn(() => false),
}))

import { formatNotification, sendTelegramMessage } from './bot'
import { readTelegramConfig, isTelegramEnabled } from '@/lib/telegram/config'

const mockEnabled = isTelegramEnabled as ReturnType<typeof vi.fn>
const mockConfig = readTelegramConfig as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockEnabled.mockReturnValue(false)
  mockConfig.mockReturnValue(null)
})

describe('formatNotification', () => {
  it('uses 🔴 emoji for critical severity', () => {
    const text = formatNotification({ title: 'Test', body: 'body', severity: 'critical', type: 'system' })
    expect(text).toMatch(/^🔴/)
  })

  it('uses ⚠️ emoji for warning severity', () => {
    const text = formatNotification({ title: 'Test', body: 'body', severity: 'warning', type: 'system' })
    expect(text).toMatch(/^⚠️/)
  })

  it('uses ℹ️ emoji for info severity', () => {
    const text = formatNotification({ title: 'Test', body: 'body', severity: 'info', type: 'system' })
    expect(text).toMatch(/^ℹ️/)
  })

  it('includes title and body', () => {
    const text = formatNotification({ title: 'My Title', body: 'My body text', severity: 'info', type: 'system' })
    expect(text).toContain('My Title')
    expect(text).toContain('My body text')
  })

  it('includes link line when link is provided', () => {
    const text = formatNotification({ title: 'T', body: 'B', severity: 'info', type: 'system', link: '/delegations/123' })
    expect(text).toContain('→ /delegations/123')
  })

  it('omits link line when no link is provided', () => {
    const text = formatNotification({ title: 'T', body: 'B', severity: 'info', type: 'system' })
    expect(text).not.toContain('→')
  })

  it('uses fallback emoji for unknown severity', () => {
    const text = formatNotification({ title: 'T', body: 'B', severity: 'unknown', type: 'system' })
    expect(text).toMatch(/^ℹ️/)
  })
})

describe('sendTelegramMessage', () => {
  it('returns false when not enabled (no fetch call)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await sendTelegramMessage('hello')
    expect(result).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('returns false when config is null even if enabled returns true', async () => {
    mockEnabled.mockReturnValue(true)
    mockConfig.mockReturnValue(null)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await sendTelegramMessage('hello')
    expect(result).toBe(false)
    fetchSpy.mockRestore()
  })

  it('calls Telegram API and returns ok status', async () => {
    mockEnabled.mockReturnValue(true)
    mockConfig.mockReturnValue({ botToken: 'test-token', chatId: '12345', enabled: true, notifyOnSeverity: ['warning'] })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response)
    const result = await sendTelegramMessage('hello')
    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({ method: 'POST' }),
    )
    fetchSpy.mockRestore()
  })
})
