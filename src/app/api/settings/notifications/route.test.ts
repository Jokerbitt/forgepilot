import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the preferences store
vi.mock('@/lib/notifications/preferences-store', () => ({
  readNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))

import { GET, PUT } from './route'
import {
  readNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications/preferences-store'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/models/notification-preferences'

const mockRead = vi.mocked(readNotificationPreferences)
const mockUpdate = vi.mocked(updateNotificationPreferences)

beforeEach(() => {
  vi.clearAllMocks()
  mockRead.mockReturnValue({ ...DEFAULT_NOTIFICATION_PREFERENCES })
  mockUpdate.mockImplementation((patch) => ({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...patch,
    types: { ...DEFAULT_NOTIFICATION_PREFERENCES.types, ...(patch.types ?? {}) },
    updatedAt: '2026-01-01T00:00:00.000Z',
  }))
})

describe('GET /api/settings/notifications', () => {
  it('returns the current notification preferences', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.muteAll).toBe(false)
    expect(body.showBadge).toBe(true)
    expect(body.types['system']).toBe(true)
    expect(mockRead).toHaveBeenCalledOnce()
  })
})

describe('PUT /api/settings/notifications', () => {
  it('updates muteAll flag', async () => {
    const req = new NextRequest('http://localhost/api/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({ muteAll: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ muteAll: true })
  })

  it('updates showBadge flag', async () => {
    const req = new NextRequest('http://localhost/api/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({ showBadge: false }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ showBadge: false })
  })

  it('updates a specific notification type', async () => {
    const req = new NextRequest('http://localhost/api/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({ types: { 'pm-alert': false } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ types: { 'pm-alert': false } })
  })

  it('returns 400 for invalid body (wrong type on muteAll)', async () => {
    const req = new NextRequest('http://localhost/api/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({ muteAll: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/settings/notifications', {
      method: 'PUT',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid JSON')
  })

  it('accepts an empty body (no-op update)', async () => {
    const req = new NextRequest('http://localhost/api/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({})
  })
})
