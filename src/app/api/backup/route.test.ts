import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/config/backup', () => ({
  runBackup: vi.fn(),
  listBackups: vi.fn(),
  restoreBackup: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/backup', () => {
  it('returns list of available backups', async () => {
    const { listBackups } = await import('@/lib/config/backup')
    vi.mocked(listBackups).mockReturnValue({ backups: ['2024-01-01', '2024-01-02'] } as ReturnType<typeof listBackups>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { backups: string[] }

    expect(res.status).toBe(200)
    expect(body.backups).toHaveLength(2)
  })
})

describe('POST /api/backup', () => {
  it('creates a new backup and returns 201', async () => {
    const { runBackup } = await import('@/lib/config/backup')
    vi.mocked(runBackup).mockReturnValue({ date: '2024-01-01', files: ['delegations.json'], alreadyExisted: false } as ReturnType<typeof runBackup>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/backup', { method: 'POST', body: null })
    const res = await POST(req)

    expect(res.status).toBe(201)
  })

  it('returns 200 when backup already exists', async () => {
    const { runBackup } = await import('@/lib/config/backup')
    vi.mocked(runBackup).mockReturnValue({ date: '2024-01-01', files: [], alreadyExisted: true } as ReturnType<typeof runBackup>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/backup', { method: 'POST', body: null })
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('restores backup for valid date', async () => {
    const { restoreBackup } = await import('@/lib/config/backup')
    vi.mocked(restoreBackup).mockReturnValue(['delegations.json', 'api-keys.json'] as ReturnType<typeof restoreBackup>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/backup?restore=2024-01-01', { method: 'POST', body: null })
    const res = await POST(req)
    const body = await res.json() as { restored: string[]; count: number }

    expect(res.status).toBe(200)
    expect(body.count).toBe(2)
  })

  it('returns 400 for invalid restore date format', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/backup?restore=not-a-date', { method: 'POST', body: null })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when backup to restore not found', async () => {
    const { restoreBackup } = await import('@/lib/config/backup')
    vi.mocked(restoreBackup).mockImplementation(() => { throw new Error('Backup not found for 2020-01-01') })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/backup?restore=2020-01-01', { method: 'POST', body: null })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})
