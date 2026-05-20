import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/telegram/config', () => ({
  readTelegramConfig: vi.fn(() => ({ botToken: 'tok', chatId: '99999', enabled: true, notifyOnSeverity: ['warning', 'critical'] })),
  isTelegramEnabled: vi.fn(() => true),
}))

vi.mock('@/lib/delegations/queue', () => ({
  readDelegations: vi.fn(() => []),
}))

vi.mock('@/lib/notifications/notification-store', () => ({
  readNotifications: vi.fn(() => []),
  getUnreadCount: vi.fn(() => 0),
}))

vi.mock('@/lib/agent-runs/store', () => ({
  getRuns: vi.fn(() => []),
}))

vi.mock('@/lib/digest/digest-builder', () => ({
  buildDigest: vi.fn(() => ({ emailBody: 'Digest text here', sections: [], stats: {}, period: 'daily', generatedAt: '', since: '' })),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    readFileSync: vi.fn(() => '[]'),
  },
}))

import { handleTelegramUpdate } from './commands'
import { readTelegramConfig } from '@/lib/telegram/config'

const mockConfig = readTelegramConfig as ReturnType<typeof vi.fn>

const AUTHORIZED_CHAT_ID = 99999

function makeUpdate(text: string, chatId = AUTHORIZED_CHAT_ID) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: chatId, username: 'sven' },
      chat: { id: chatId },
      text,
      date: Date.now(),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockConfig.mockReturnValue({ botToken: 'tok', chatId: String(AUTHORIZED_CHAT_ID), enabled: true, notifyOnSeverity: ['warning', 'critical'] })
})

describe('handleTelegramUpdate', () => {
  it('returns null for non-command messages', async () => {
    const result = await handleTelegramUpdate(makeUpdate('Hello, just a message'))
    expect(result).toBeNull()
  })

  it('returns unauthorized for wrong chatId', async () => {
    const result = await handleTelegramUpdate(makeUpdate('/help', 11111))
    expect(result).toBe('⛔ Unauthorized')
  })

  it('/help returns text containing /status', async () => {
    const result = await handleTelegramUpdate(makeUpdate('/help'))
    expect(result).toContain('/status')
  })

  it('/help returns text containing /approve', async () => {
    const result = await handleTelegramUpdate(makeUpdate('/help'))
    expect(result).toContain('/approve')
  })

  it('/status returns delegation counts', async () => {
    const result = await handleTelegramUpdate(makeUpdate('/status'))
    expect(result).toContain('Pending')
  })

  it('/runs returns info when no runs exist', async () => {
    const result = await handleTelegramUpdate(makeUpdate('/runs'))
    expect(result).toContain('keine')
  })

  it('/notif returns info when no unread notifications', async () => {
    const result = await handleTelegramUpdate(makeUpdate('/notif'))
    expect(result?.toLowerCase()).toContain('keine')
  })

  it('unknown command suggests /help', async () => {
    const result = await handleTelegramUpdate(makeUpdate('/unknown_cmd'))
    expect(result).toContain('/help')
  })

  it('returns null when message has no text', async () => {
    const result = await handleTelegramUpdate({ update_id: 1, message: { message_id: 1, from: { id: AUTHORIZED_CHAT_ID }, chat: { id: AUTHORIZED_CHAT_ID }, date: Date.now() } })
    expect(result).toBeNull()
  })

  it('returns null when no message', async () => {
    const result = await handleTelegramUpdate({ update_id: 1 })
    expect(result).toBeNull()
  })
})
