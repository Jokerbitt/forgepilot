import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/notifications/notification-store', () => ({
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/notifications/mark-read', () => {
  it('marks all notifications as read when all=true', async () => {
    const { markAllAsRead } = await import('@/lib/notifications/notification-store')
    vi.mocked(markAllAsRead).mockReturnValue(undefined)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ all: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { success: boolean }

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(vi.mocked(markAllAsRead)).toHaveBeenCalled()
  })

  it('marks a single notification as read by id', async () => {
    const { markAsRead } = await import('@/lib/notifications/notification-store')
    vi.mocked(markAsRead).mockReturnValue(true)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ id: 'notif-42' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { success: boolean }

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(vi.mocked(markAsRead)).toHaveBeenCalledWith('notif-42')
  })

  it('returns 404 when single notification is not found', async () => {
    const { markAsRead } = await import('@/lib/notifications/notification-store')
    vi.mocked(markAsRead).mockReturnValue(false)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ id: 'missing' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})
