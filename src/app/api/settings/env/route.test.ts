import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bypass auth for unit tests — auth behaviour is tested in require-auth.test.ts
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn().mockResolvedValue(null) }))

// Mock filesystem and path helpers so tests don't touch disk
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => { throw new Error('ENOENT') }),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
  },
}))

vi.mock('@/lib/config/paths', () => ({
  getDataDir: vi.fn(() => '/tmp/forgepilot-test'),
}))

import { POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/settings/env', () => {
  it('returns 200 and ok:true for an allowed key (GOOGLE_API_KEY)', async () => {
    const req = new Request('http://localhost/api/settings/env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'GOOGLE_API_KEY', value: 'AIzaTestKey123' }),
    })

    const res = await POST(req)
    const data = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
  })

  it('returns 403 for a disallowed key (ANTHROPIC_API_KEY)', async () => {
    const req = new Request('http://localhost/api/settings/env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ANTHROPIC_API_KEY', value: 'sk-ant-secret' }),
    })

    const res = await POST(req)
    const data = await res.json() as { ok: boolean; error: string }

    expect(res.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.error).toContain('allowlist')
  })

  it('returns 400 when key is missing from the body', async () => {
    const req = new Request('http://localhost/api/settings/env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'somevalue' }),
    })

    const res = await POST(req)
    const data = await res.json() as { error: string; fields: Record<string, string> }

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.key).toBeTruthy()
  })

  it('returns 400 when value is an empty string', async () => {
    const req = new Request('http://localhost/api/settings/env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'GOOGLE_API_KEY', value: '' }),
    })

    const res = await POST(req)
    const data = await res.json() as { error: string; fields: Record<string, string> }

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.fields.value).toBeTruthy()
  })
})
