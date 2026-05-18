import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import type { Notification } from '@/lib/models/notification'

// We need to reset the module's state by manipulating the file between tests
const NOTIFICATIONS_FILE = path.join(process.cwd(), 'config', 'notifications.json')
const BACKUP_FILE = NOTIFICATIONS_FILE + '.bak'

function cleanFile() {
  if (fs.existsSync(NOTIFICATIONS_FILE)) {
    fs.unlinkSync(NOTIFICATIONS_FILE)
  }
  if (fs.existsSync(NOTIFICATIONS_FILE + '.tmp')) {
    fs.unlinkSync(NOTIFICATIONS_FILE + '.tmp')
  }
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'test-id-1',
    type: 'pm-alert',
    severity: 'critical',
    title: 'Test Alert',
    body: 'Something went wrong',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('notification-store', () => {
  // Backup existing file before tests and restore after
  beforeEach(() => {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      fs.copyFileSync(NOTIFICATIONS_FILE, BACKUP_FILE)
    }
    cleanFile()
  })

  afterEach(() => {
    cleanFile()
    if (fs.existsSync(BACKUP_FILE)) {
      fs.copyFileSync(BACKUP_FILE, NOTIFICATIONS_FILE)
      fs.unlinkSync(BACKUP_FILE)
    }
  })

  it('returns empty array when no notifications file exists', async () => {
    const { readNotifications } = await import('./notification-store')
    const result = readNotifications()
    expect(result).toEqual([])
  })

  it('saves and reads a notification (round-trip)', async () => {
    const { saveNotification, readNotifications } = await import('./notification-store')
    const notification = makeNotification()
    saveNotification(notification)
    const result = readNotifications()
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(notification)
  })

  it('saves multiple notifications and returns all', async () => {
    const { saveNotification, readNotifications } = await import('./notification-store')
    const n1 = makeNotification({ id: 'id-1', title: 'First' })
    const n2 = makeNotification({ id: 'id-2', title: 'Second' })
    saveNotification(n1)
    saveNotification(n2)
    const result = readNotifications()
    expect(result).toHaveLength(2)
    // Most recent first (unshift)
    expect(result[0].id).toBe('id-2')
    expect(result[1].id).toBe('id-1')
  })

  it('markAsRead sets read=true for matching id', async () => {
    const { saveNotification, markAsRead, readNotifications } = await import('./notification-store')
    const notification = makeNotification({ id: 'mark-me' })
    saveNotification(notification)
    const success = markAsRead('mark-me')
    expect(success).toBe(true)
    const result = readNotifications()
    expect(result[0].read).toBe(true)
  })

  it('markAsRead returns false for unknown id', async () => {
    const { markAsRead } = await import('./notification-store')
    const success = markAsRead('nonexistent-id')
    expect(success).toBe(false)
  })

  it('getUnreadCount returns correct count', async () => {
    const { saveNotification, markAsRead, getUnreadCount } = await import('./notification-store')
    saveNotification(makeNotification({ id: 'n1', read: false }))
    saveNotification(makeNotification({ id: 'n2', read: false }))
    saveNotification(makeNotification({ id: 'n3', read: false }))
    markAsRead('n1')
    const count = getUnreadCount()
    expect(count).toBe(2)
  })

  it('getUnreadCount returns 0 when all notifications are read', async () => {
    const { saveNotification, markAsRead, getUnreadCount } = await import('./notification-store')
    saveNotification(makeNotification({ id: 'r1' }))
    saveNotification(makeNotification({ id: 'r2' }))
    markAsRead('r1')
    markAsRead('r2')
    const count = getUnreadCount()
    expect(count).toBe(0)
  })
})
