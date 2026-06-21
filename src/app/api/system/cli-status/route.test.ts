import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(),
}))

vi.mock('@/lib/system/runner-readiness', () => ({
  getCachedOrShallowRunnerReadiness: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/system/cli-status', () => {
  it('prefers Claude CLI only after headless readiness is confirmed', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getCachedOrShallowRunnerReadiness } = await import('@/lib/system/runner-readiness')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('claude --version')) return 'claude 1.0.0' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('claude auth status')) return 'authenticated' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('codex')) throw new Error('not found')
      return '' as unknown as ReturnType<typeof execSync>
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(getCachedOrShallowRunnerReadiness).mockReturnValue({
      ready: true,
      activeMode: 'claude-cli',
      zeroKeyReady: true,
      claude: { available: true, headlessReady: true, version: 'claude 1.0.0', detail: 'Claude CLI kann headless Prompts ausfuehren.' },
      codex: { available: false, headlessReady: false, version: null, detail: 'codex fehlt.' },
      claudeApiKeySet: false,
      openAiApiKeySet: false,
      recommendation: 'Echte Zero-Key-Ausfuehrung ist bereit.',
      checkedAt: '2026-05-31T10:00:00.000Z',
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { activeMode: string; zeroKeyReady: boolean; claudeCliVersion: string | null }

    expect(res.status).toBe(200)
    expect(body.activeMode).toBe('claude-cli')
    expect(body.zeroKeyReady).toBe(true)
    expect(body.claudeCliVersion).toBe('claude 1.0.0')
  })

  it('does not mark installed CLIs as zero-key ready before the headless check passes', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getCachedOrShallowRunnerReadiness } = await import('@/lib/system/runner-readiness')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('claude')) throw new Error('not found')
      if (cmd.includes('codex --version')) return 'codex 1.0.0' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('codex auth status')) return 'logged in' as unknown as ReturnType<typeof execSync>
      return '' as unknown as ReturnType<typeof execSync>
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(getCachedOrShallowRunnerReadiness).mockReturnValue({
      ready: false,
      activeMode: 'simulation',
      zeroKeyReady: false,
      claude: { available: false, headlessReady: false, version: null, detail: 'claude fehlt.' },
      codex: { available: true, headlessReady: false, version: 'codex 1.0.0', detail: 'Codex installiert, Headless nicht bestaetigt.' },
      claudeApiKeySet: false,
      openAiApiKeySet: false,
      recommendation: 'Kein echter Runner bereit.',
      checkedAt: '2026-05-31T10:00:00.000Z',
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { activeMode: string; zeroKeyReady: boolean; codexCliVersion: string | null }

    expect(res.status).toBe(200)
    expect(body.activeMode).toBe('simulation')
    expect(body.zeroKeyReady).toBe(false)
    expect(body.codexCliVersion).toBe('codex 1.0.0')
  })

  it('falls back to simulation without CLI or API keys', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getCachedOrShallowRunnerReadiness } = await import('@/lib/system/runner-readiness')

    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found')
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(getCachedOrShallowRunnerReadiness).mockReturnValue({
      ready: false,
      activeMode: 'simulation',
      zeroKeyReady: false,
      claude: { available: false, headlessReady: false, version: null, detail: 'claude fehlt.' },
      codex: { available: false, headlessReady: false, version: null, detail: 'codex fehlt.' },
      claudeApiKeySet: false,
      openAiApiKeySet: false,
      recommendation: 'Kein echter Runner bereit.',
      checkedAt: '2026-05-31T10:00:00.000Z',
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { activeMode: string; zeroKeyReady: boolean; apiKeysOptional: boolean }

    expect(res.status).toBe(200)
    expect(body.activeMode).toBe('simulation')
    expect(body.zeroKeyReady).toBe(false)
    expect(body.apiKeysOptional).toBe(true)
  })
})
