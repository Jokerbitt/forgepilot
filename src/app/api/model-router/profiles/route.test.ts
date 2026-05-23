import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/model-router/store', () => ({
  getProfiles: vi.fn(),
  upsertProfile: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/model-router/profiles', () => {
  it('returns all model profiles', async () => {
    const { getProfiles } = await import('@/lib/model-router/store')
    vi.mocked(getProfiles).mockReturnValue([
      { id: 'claude-sonnet', provider: 'anthropic', modelName: 'claude-sonnet-4-6' },
    ] as ReturnType<typeof getProfiles>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { id: string }[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('claude-sonnet')
  })
})

describe('POST /api/model-router/profiles', () => {
  it('creates a new profile and returns 201', async () => {
    const { upsertProfile } = await import('@/lib/model-router/store')
    vi.mocked(upsertProfile).mockReturnValue({ id: 'new-profile', provider: 'anthropic', modelName: 'claude-haiku' } as ReturnType<typeof upsertProfile>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/model-router/profiles', {
      method: 'POST',
      body: JSON.stringify({ id: 'new-profile', provider: 'anthropic', modelName: 'claude-haiku' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { id: string }

    expect(res.status).toBe(201)
    expect(body.id).toBe('new-profile')
  })

  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/model-router/profiles', {
      method: 'POST',
      body: JSON.stringify({ id: 'no-provider' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
