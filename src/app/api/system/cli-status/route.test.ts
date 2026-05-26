import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/system/cli-status', () => {
  it('prefers Claude CLI as zero-key mode', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('claude --version')) return 'claude 1.0.0' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('claude auth status')) return 'authenticated' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('codex')) throw new Error('not found')
      return '' as unknown as ReturnType<typeof execSync>
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { activeMode: string; zeroKeyReady: boolean; claudeCliVersion: string | null }

    expect(res.status).toBe(200)
    expect(body.activeMode).toBe('claude-cli')
    expect(body.zeroKeyReady).toBe(true)
    expect(body.claudeCliVersion).toBe('claude 1.0.0')
  })

  it('uses Codex CLI when Claude CLI is unavailable', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('claude')) throw new Error('not found')
      if (cmd.includes('codex --version')) return 'codex 1.0.0' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('codex auth status')) return 'logged in' as unknown as ReturnType<typeof execSync>
      return '' as unknown as ReturnType<typeof execSync>
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { activeMode: string; zeroKeyReady: boolean; codexCliVersion: string | null }

    expect(res.status).toBe(200)
    expect(body.activeMode).toBe('codex-cli')
    expect(body.zeroKeyReady).toBe(true)
    expect(body.codexCliVersion).toBe('codex 1.0.0')
  })

  it('falls back to simulation without CLI or API keys', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found')
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { activeMode: string; zeroKeyReady: boolean; apiKeysOptional: boolean }

    expect(res.status).toBe(200)
    expect(body.activeMode).toBe('simulation')
    expect(body.zeroKeyReady).toBe(false)
    expect(body.apiKeysOptional).toBe(true)
  })
})
