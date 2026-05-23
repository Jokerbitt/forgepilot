import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  default: {
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/backup', () => {
  it('returns all config files as a bundle with Content-Disposition header', async () => {
    const fs = await import('fs')
    vi.mocked(fs.default.readdirSync).mockReturnValue(['delegations.json', 'api-keys.json'] as unknown as ReturnType<typeof fs.default.readdirSync>)
    vi.mocked(fs.default.readFileSync).mockReturnValue('{"key":"value"}' as unknown as ReturnType<typeof fs.default.readFileSync>)

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    const body = await res.json() as { _meta: { fileCount: number }; config: Record<string, unknown> }
    expect(body._meta.fileCount).toBe(2)
    expect(body.config['delegations.json']).toEqual({ key: 'value' })
  })

  it('returns 500 when reading directory fails', async () => {
    const fs = await import('fs')
    vi.mocked(fs.default.readdirSync).mockImplementation(() => { throw new Error('Permission denied') })

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
