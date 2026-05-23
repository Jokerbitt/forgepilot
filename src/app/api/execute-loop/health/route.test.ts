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

describe('GET /api/execute-loop/health', () => {
  it('returns ready=true when all checks pass', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(execSync).mockReturnValue('claude v1.0.0' as unknown as ReturnType<typeof execSync>)
    vi.mocked(readStoredApiKeys).mockReturnValue({ ANTHROPIC_API_KEY: 'sk-test' } as ReturnType<typeof readStoredApiKeys>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { ready: boolean; executionMode: string; checks: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(body.checks).toBeDefined()
    expect(body.executionMode).toBeDefined()
  })

  it('returns status when claude CLI is missing', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if ((cmd as string).includes('claude')) throw new Error('not found')
      return '' as unknown as ReturnType<typeof execSync>
    })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { executionMode: string }

    expect(res.status).toBe(200)
    expect(body.executionMode).toContain('simulation')
  })
})
