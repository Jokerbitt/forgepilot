import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/telegram/config', () => ({
  readTelegramConfig: vi.fn(() => ({
    botToken: 'tok',
    chatId: '99999',
    enabled: true,
    notifyOnSeverity: ['warning', 'critical'],
  })),
  isTelegramEnabled: vi.fn(() => true),
}))

vi.mock('@/lib/delegations/queue', () => ({
  readDelegations: vi.fn(() => [
    { id: 'del-abc', title: 'Test Delegation', status: 'pending', updatedAt: new Date().toISOString() },
  ]),
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

import { delegationApprovalKeyboard } from './bot'
import { handleCallbackQuery } from './commands'
import { readTelegramConfig } from '@/lib/telegram/config'

const mockConfig = readTelegramConfig as ReturnType<typeof vi.fn>
const CHAT_ID = 99999

function makeCbq(data: string, chatId = CHAT_ID) {
  return {
    id: 'cbq-001',
    from: { id: chatId, username: 'sven' },
    message: {
      message_id: 42,
      chat: { id: chatId },
      text: 'original message',
    },
    data,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockConfig.mockReturnValue({ botToken: 'tok', chatId: String(CHAT_ID), enabled: true, notifyOnSeverity: ['warning', 'critical'] })
})

describe('delegationApprovalKeyboard', () => {
  it('returns inline_keyboard with two buttons', () => {
    const kb = delegationApprovalKeyboard('del-123')
    expect(kb.inline_keyboard).toHaveLength(1)
    expect(kb.inline_keyboard[0]).toHaveLength(2)
  })

  it('approve button has correct callback_data', () => {
    const kb = delegationApprovalKeyboard('del-123')
    expect(kb.inline_keyboard[0][0].callback_data).toBe('approve_del-123')
  })

  it('reject button has correct callback_data', () => {
    const kb = delegationApprovalKeyboard('del-123')
    expect(kb.inline_keyboard[0][1].callback_data).toBe('reject_del-123')
  })

  it('buttons have readable text', () => {
    const kb = delegationApprovalKeyboard('del-123')
    expect(kb.inline_keyboard[0][0].text).toContain('Genehmigen')
    expect(kb.inline_keyboard[0][1].text).toContain('Ablehnen')
  })
})

describe('handleCallbackQuery', () => {
  it('returns null for unknown callback data', () => {
    const result = handleCallbackQuery(makeCbq('unknown_xyz'))
    expect(result).toBeNull()
  })

  it('returns null for unauthorized chat', () => {
    const result = handleCallbackQuery(makeCbq('approve_del-abc', 11111))
    expect(result).toBeNull()
  })

  it('approve callback returns success toast and edited text', () => {
    const result = handleCallbackQuery(makeCbq('approve_del-abc'))
    expect(result).not.toBeNull()
    expect(result?.toast).toContain('Genehmigt')
    expect(result?.editedText).toContain('Test Delegation')
  })

  it('reject callback returns rejection toast and edited text', () => {
    const result = handleCallbackQuery(makeCbq('reject_del-abc'))
    expect(result).not.toBeNull()
    expect(result?.toast).toContain('Abgelehnt')
    expect(result?.editedText).toContain('Abgelehnt')
  })

  it('approve callback for unknown id returns error message', () => {
    const result = handleCallbackQuery(makeCbq('approve_nonexistent-id'))
    expect(result).not.toBeNull()
    expect(result?.editedText).toContain('nicht gefunden')
  })

  it('editedText contains Markdown for approved delegation', () => {
    const result = handleCallbackQuery(makeCbq('approve_del-abc'))
    expect(result?.editedText).toMatch(/\*Genehmigt/)
  })
})
