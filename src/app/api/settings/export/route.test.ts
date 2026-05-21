import { describe, expect, it, vi } from 'vitest'

// Bypass auth for unit tests — auth behaviour is tested in require-auth.test.ts
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/settings/settings-bundle', () => ({
  exportSettingsBundle: vi.fn(() => ({
    version: 1,
    exportedAt: '2026-05-21T08:00:00.000Z',
    configs: {
      'nba-settings.json': { approvalMode: 'manual' },
    },
  })),
}))

import { GET } from './route'

describe('GET /api/settings/export', () => {
  it('returns a JSON settings bundle as attachment', async () => {
    const res = await GET()
    const data = await res.json() as { version: number; configs: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    expect(res.headers.get('Content-Disposition')).toContain('forgepilot-settings-')
    expect(data.version).toBe(1)
    expect(data.configs['nba-settings.json']).toEqual({ approvalMode: 'manual' })
  })

  it('does not expose API keys in the mocked export payload', async () => {
    const res = await GET()
    const text = await res.text()

    expect(text).not.toContain('api-keys.json')
    expect(text).not.toContain('GITHUB_TOKEN')
    expect(text).not.toContain('ANTHROPIC_API_KEY')
  })
})
