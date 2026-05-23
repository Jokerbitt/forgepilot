import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/dsgvo/zip-export', () => ({
  buildDsgvoExportZip: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  dsgvoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/dsgvo/export', () => {
  it('returns a zip file with correct headers', async () => {
    const { buildDsgvoExportZip } = await import('@/lib/dsgvo/zip-export')
    vi.mocked(buildDsgvoExportZip).mockResolvedValue(Buffer.from('PK fake zip data'))

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/zip')
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="forgepilot-export-/)
  })

  it('returns 500 when zip generation fails', async () => {
    const { buildDsgvoExportZip } = await import('@/lib/dsgvo/zip-export')
    vi.mocked(buildDsgvoExportZip).mockRejectedValue(new Error('disk full'))

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
