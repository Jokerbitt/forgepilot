import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/notifications/notification-store', () => ({
  markAsRead: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/notifications/[id]/read', () => {
  it('marks notification as read and returns success=true', async () => {
    const { markAsRead } = await import('@/lib/notifications/notification-store')
    vi.mocked(markAsRead).mockReturnValue(true)

    const { PATCH } = await import('./route')
    const res = await PATCH(new Request('http://localhost'), { params: Promise.resolve({ id: 'notif-1' }) })
    const body = await res.json() as { success: boolean }

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(vi.mocked(markAsRead)).toHaveBeenCalledWith('notif-1')
  })

  it('returns 404 when notification is not found', async () => {
    const { markAsRead } = await import('@/lib/notifications/notification-store')
    vi.mocked(markAsRead).mockReturnValue(false)

    const { PATCH } = await import('./route')
    const res = await PATCH(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
