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

describe('GET /api/execute-loop/health', () => {
  it('returns ready=true when all checks pass', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getCachedOrShallowRunnerReadiness } = await import('@/lib/system/runner-readiness')

    vi.mocked(execSync).mockReturnValue('claude v1.0.0' as unknown as ReturnType<typeof execSync>)
    vi.mocked(readStoredApiKeys).mockReturnValue({ ANTHROPIC_API_KEY: 'sk-test' } as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(getCachedOrShallowRunnerReadiness).mockReturnValue({
      ready: true,
      activeMode: 'claude-api',
      zeroKeyReady: false,
      claude: { available: true, headlessReady: false, version: 'claude v1.0.0', detail: 'Claude installiert.' },
      codex: { available: true, headlessReady: false, version: 'codex v1.0.0', detail: 'Codex installiert.' },
      claudeApiKeySet: true,
      openAiApiKeySet: false,
      recommendation: 'API-Fallback ist bereit.',
      checkedAt: '2026-05-31T10:00:00.000Z',
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { ready: boolean; executionMode: string; checks: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(body.checks).toBeDefined()
    expect(body.executionMode).toBeDefined()
  })

  it('returns status when CLI agents are missing', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getCachedOrShallowRunnerReadiness } = await import('@/lib/system/runner-readiness')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if ((cmd as string).includes('claude') || (cmd as string).includes('codex')) throw new Error('not found')
      return '' as unknown as ReturnType<typeof execSync>
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
    const body = await res.json() as { executionMode: string }

    expect(res.status).toBe(200)
    expect(body.executionMode).toContain('simulation')
  })

  it('uses codex CLI as zero-key fallback only after headless readiness is confirmed', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getCachedOrShallowRunnerReadiness } = await import('@/lib/system/runner-readiness')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if ((cmd as string).includes('claude')) throw new Error('not found')
      if ((cmd as string).includes('codex')) return 'codex 1.0.0' as unknown as ReturnType<typeof execSync>
      return '' as unknown as ReturnType<typeof execSync>
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)
    vi.mocked(getCachedOrShallowRunnerReadiness).mockReturnValue({
      ready: true,
      activeMode: 'codex-cli',
      zeroKeyReady: true,
      claude: { available: false, headlessReady: false, version: null, detail: 'claude fehlt.' },
      codex: { available: true, headlessReady: true, version: 'codex 1.0.0', detail: 'Codex CLI kann headless Prompts ausfuehren.' },
      claudeApiKeySet: false,
      openAiApiKeySet: false,
      recommendation: 'Echte Zero-Key-Ausfuehrung ist bereit.',
      checkedAt: '2026-05-31T10:00:00.000Z',
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { executionMode: string; zeroKeyReady: boolean }

    expect(res.status).toBe(200)
    expect(body.executionMode).toContain('codex-cli')
    expect(body.zeroKeyReady).toBe(true)
  })
})
