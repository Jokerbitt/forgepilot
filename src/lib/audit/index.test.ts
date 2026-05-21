import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logAuditEvent, getAuditLog, getAuditStats } from './index'

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '[]'),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}))

describe('Audit log', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('logAuditEvent returns an entry with id and createdAt', () => {
    const entry = logAuditEvent({
      action: 'delegation.created',
      entityId: 'del-1',
      entityType: 'delegation',
      actor: 'user',
    })
    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('createdAt')
    expect(entry.action).toBe('delegation.created')
  })

  it('getAuditLog returns empty array when no file', () => {
    const result = getAuditLog()
    expect(Array.isArray(result)).toBe(true)
  })

  it('getAuditStats returns correct shape', () => {
    const stats = getAuditStats()
    expect(stats).toHaveProperty('total')
    expect(stats).toHaveProperty('last24h')
    expect(stats).toHaveProperty('byAction')
  })
})
