import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  importSettingsBundle: vi.fn(),
}))

vi.mock('@/lib/settings/settings-bundle', () => ({
  importSettingsBundle: mocks.importSettingsBundle,
}))

import { POST } from './route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/settings/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/settings/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.importSettingsBundle.mockReturnValue({ imported: [], skipped: [], errors: [] })
  })

  it('imports a valid settings bundle', async () => {
    mocks.importSettingsBundle.mockReturnValue({
      imported: ['nba-settings.json'],
      skipped: ['api-keys.json'],
      errors: [],
    })

    const res = await POST(makeRequest({
      version: 1,
      exportedAt: '2026-05-21T08:00:00.000Z',
      configs: {
        'nba-settings.json': { approvalMode: 'balanced' },
        'api-keys.json': { GITHUB_TOKEN: 'secret' },
      },
    }))
    const data = await res.json() as { ok: boolean; imported: string[]; skipped: string[] }

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.imported).toEqual(['nba-settings.json'])
    expect(data.skipped).toEqual(['api-keys.json'])
    expect(mocks.importSettingsBundle).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid JSON', async () => {
    const res = await POST(makeRequest('{not-json'))
    const data = await res.json() as { error: string }

    expect(res.status).toBe(400)
    expect(data.error).toContain('Invalid JSON')
    expect(mocks.importSettingsBundle).not.toHaveBeenCalled()
  })

  it('rejects invalid bundle shape', async () => {
    const res = await POST(makeRequest({ version: 2, configs: {} }))
    const data = await res.json() as { error: string }

    expect(res.status).toBe(400)
    expect(data.error).toContain('Invalid bundle format')
    expect(mocks.importSettingsBundle).not.toHaveBeenCalled()
  })

  it('returns a failed result when import writes fail', async () => {
    mocks.importSettingsBundle.mockReturnValue({
      imported: [],
      skipped: [],
      errors: ['nba-settings.json: disk full'],
    })

    const res = await POST(makeRequest({
      version: 1,
      exportedAt: '2026-05-21T08:00:00.000Z',
      configs: { 'nba-settings.json': { approvalMode: 'manual' } },
    }))
    const data = await res.json() as { ok: boolean; errors: string[] }

    expect(res.status).toBe(500)
    expect(data.ok).toBe(false)
    expect(data.errors).toEqual(['nba-settings.json: disk full'])
  })
})
