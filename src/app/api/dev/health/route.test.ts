import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))
vi.mock('fs', () => ({
  default: { existsSync: vi.fn().mockReturnValue(false) },
  existsSync: vi.fn().mockReturnValue(false),
}))
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/dev/health', () => {
  it('returns a HealthReport with overall and checks', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(execSync).mockReturnValue('claude v1.2.3' as unknown as ReturnType<typeof execSync>)
    vi.mocked(readStoredApiKeys).mockReturnValue({ ANTHROPIC_API_KEY: 'sk-ant-test' } as ReturnType<typeof readStoredApiKeys>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { overall: string; checks: unknown[]; executionMode: string }

    expect(res.status).toBe(200)
    expect(['ok', 'warn', 'error']).toContain(body.overall)
    expect(Array.isArray(body.checks)).toBe(true)
    expect(body.executionMode).toBeDefined()
  })

  it('returns warn when Claude CLI is missing', async () => {
    const { execSync } = await import('child_process')
    const { readStoredApiKeys } = await import('@/lib/connectors/config')

    vi.mocked(execSync).mockImplementation(() => { throw new Error('not found') })
    vi.mocked(readStoredApiKeys).mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { overall: string }

    expect(res.status).toBe(200)
    expect(body.overall).toBe('warn')
  })
})
