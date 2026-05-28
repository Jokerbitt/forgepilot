import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runner readiness', () => {
  it('prefers Claude CLI when the headless ping works', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getRunnerReadiness } = await import('./runner-readiness')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('claude --version')) return 'Claude Code 2.1.0' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('claude -p')) return '{"type":"result","result":"PONG"}' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('codex --version')) return 'codex-cli 0.1.0' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('codex exec')) return 'PONG' as unknown as ReturnType<typeof execSync>
      return '' as unknown as ReturnType<typeof execSync>
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const readiness = getRunnerReadiness({ deep: true, cwd: '/tmp/repo' })

    expect(readiness.ready).toBe(true)
    expect(readiness.zeroKeyReady).toBe(true)
    expect(readiness.activeMode).toBe('claude-cli')
    expect(readiness.claude.headlessReady).toBe(true)
  })

  it('falls back to Codex CLI when Claude headless ping fails', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getRunnerReadiness } = await import('./runner-readiness')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('claude --version')) return 'Claude Code 2.1.0' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('claude -p')) throw new Error('not logged in')
      if (cmd.includes('codex --version')) return 'codex-cli 0.1.0' as unknown as ReturnType<typeof execSync>
      if (cmd.includes('codex exec')) return 'PONG' as unknown as ReturnType<typeof execSync>
      return '' as unknown as ReturnType<typeof execSync>
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const readiness = getRunnerReadiness({ deep: true, cwd: '/tmp/repo' })

    expect(readiness.ready).toBe(true)
    expect(readiness.zeroKeyReady).toBe(true)
    expect(readiness.activeMode).toBe('codex-cli')
    expect(readiness.claude.headlessReady).toBe(false)
    expect(readiness.codex.headlessReady).toBe(true)
  })

  it('blocks real autonomy when no CLI or API fallback is ready', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const { getRunnerReadiness } = await import('./runner-readiness')

    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found')
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const readiness = getRunnerReadiness({ deep: true, cwd: '/tmp/repo' })

    expect(readiness.ready).toBe(false)
    expect(readiness.zeroKeyReady).toBe(false)
    expect(readiness.activeMode).toBe('simulation')
  })
})
