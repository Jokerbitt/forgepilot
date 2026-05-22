/**
 * @vitest-environment node
 *
 * Tests for GET /api/notifications
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Notification } from '@/lib/models/notification'

// ── Store mock ─────────────────────────────────────────────────────────────────

const readNotifications = vi.fn<[], Notification[]>()

vi.mock('@/lib/notifications/notification-store', () => ({ readNotifications }))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-001',
    type: 'delegation_completed',
    severity: 'info',
    title: 'Task done',
    body: 'Details',
    read: false,
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(url: string) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(url)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all notifications', async () => {
    const notifications = [
      makeNotification({ id: 'notif-001', read: false }),
      makeNotification({ id: 'notif-002', read: true }),
    ]
    readNotifications.mockReturnValueOnce(notifications)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/notifications'))
    expect(res.status).toBe(200)
    const body = await res.json() as Notification[]
    expect(body).toHaveLength(2)
  })

  it('filters to unread only when ?unread=true', async () => {
    const notifications = [
      makeNotification({ id: 'notif-001', read: false }),
      makeNotification({ id: 'notif-002', read: true }),
    ]
    readNotifications.mockReturnValueOnce(notifications)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/notifications?unread=true'))
    const body = await res.json() as Notification[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('notif-001')
  })

  it('returns all when ?unread is not set', async () => {
    readNotifications.mockReturnValueOnce([
      makeNotification({ read: true }),
      makeNotification({ id: 'notif-002', read: true }),
    ])
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/notifications'))
    const body = await res.json() as Notification[]
    expect(body).toHaveLength(2)
  })
})
