import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/config/backup', () => ({
  listBackups: vi.fn(() => ({ backups: [], totalBackups: 0, oldestDate: null, newestDate: null })),
}))

describe('GET /api/backup/list', () => {
  it('returns the backup list result', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ totalBackups: 0 })
  })
})
