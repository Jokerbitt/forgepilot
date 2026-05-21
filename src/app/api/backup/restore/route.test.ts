import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/lib/config/backup', () => ({
  restoreBackup: vi.fn((date: string) => {
    if (date === '2026-05-01') throw new Error('Backup not found for date: 2026-05-01')
    return ['delegations.json']
  }),
}))

describe('POST /api/backup/restore', () => {
  it('restores a backup date from the request body', async () => {
    const res = await POST(new NextRequest('http://localhost/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-05-20' }),
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ date: '2026-05-20', count: 1 })
  })

  it('restores a backup date from query params', async () => {
    const res = await POST(new NextRequest('http://localhost/api/backup/restore?date=2026-05-20', { method: 'POST' }))
    expect(res.status).toBe(200)
  })

  it('rejects invalid dates', async () => {
    const res = await POST(new NextRequest('http://localhost/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ date: 'bad' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 for a missing backup', async () => {
    const res = await POST(new NextRequest('http://localhost/api/backup/restore?date=2026-05-01', { method: 'POST' }))
    expect(res.status).toBe(404)
  })
})
