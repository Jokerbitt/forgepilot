import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execSync } from 'child_process'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

describe('GET /api/auth/status', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns max subscription details when claude is logged in via Max', async () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
      email: 'sven.bittl@gmx.de',
      orgId: 'bca7ce30-6cc4-46ee-b9d9-b7462796770f',
      orgName: "sven.bittl@gmx.de's Organization",
      subscriptionType: 'max',
    })))

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.loggedIn).toBe(true)
    expect(data.authMethod).toBe('claude.ai')
    expect(data.subscriptionType).toBe('max')
    expect(data.email).toBe('sven.bittl@gmx.de')
  })

  it('returns logged-out fallback when claude CLI is not in PATH', async () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error('command not found: claude')
    })

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.loggedIn).toBe(false)
    expect(data.authMethod).toBe('none')
    expect(data.subscriptionType).toBe('none')
    expect(data.email).toBeUndefined()
  })

  it('returns logged-out result when CLI reports loggedIn=false', async () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from(JSON.stringify({
      loggedIn: false,
      authMethod: 'apiKey',
    })))

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.loggedIn).toBe(false)
    expect(data.authMethod).toBe('apiKey')
    expect(data.subscriptionType).toBe('none')
  })

  it('falls back gracefully on malformed JSON output', async () => {
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from('not-json'))

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.loggedIn).toBe(false)
    expect(data.authMethod).toBe('none')
  })
})
