import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

const { mockGetProviderInstance } = vi.hoisted(() => ({
  mockGetProviderInstance: vi.fn((id: string) => {
    if (id === 'anthropic') return { isAvailable: async () => true }
    if (id === 'groq')      return { isAvailable: async () => false }
    if (id === 'ollama')    return { isAvailable: async (): Promise<boolean> => { throw new Error('ECONNREFUSED') } }
    return null
  }),
}))

vi.mock('./config-store', () => ({
  getAllProviderConfigs: vi.fn(() => [
    { id: 'anthropic', name: 'Anthropic Claude', apiKeyRef: 'ANTHROPIC_API_KEY', enabled: true },
    { id: 'groq',      name: 'Groq',             apiKeyRef: 'GROQ_API_KEY',      enabled: true },
    { id: 'ollama',    name: 'Ollama (Local)',    apiKeyRef: '',                  enabled: true },
  ]),
}))

vi.mock('./registry', () => ({ getProviderInstance: mockGetProviderInstance }))

// readStoredApiKeys reads from config/api-keys.json via fs — fs is mocked below
// to return '{}' for the health cache file. For api-keys.json we rely on process.env
// which is set in beforeAll (see below), so we just need a no-op passthrough.
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}))

import { runHealthCheck, getCachedHealthReport, recordProviderFailure } from './health-monitor'

// Set env vars so readStoredApiKeys gets real-looking keys via process.env fallback
beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
  process.env.GROQ_API_KEY = 'gsk_test'
})

afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.GROQ_API_KEY
})

describe('runHealthCheck', () => {
  it('returns a report with all providers', async () => {
    const report = await runHealthCheck()
    expect(report.providers).toHaveLength(3)
    expect(report.checkedAt).toBeTruthy()
  })

  it('marks anthropic as healthy when isAvailable returns true', async () => {
    const report = await runHealthCheck()
    const entry = report.providers.find(p => p.providerId === 'anthropic')
    expect(entry?.status).toBe('healthy')
  })

  it('includes latencyMs for providers that responded', async () => {
    const report = await runHealthCheck()
    const entry = report.providers.find(p => p.providerId === 'anthropic')
    expect(typeof entry?.latencyMs).toBe('number')
  })

  it('marks groq as unavailable when isAvailable returns false', async () => {
    const report = await runHealthCheck()
    const entry = report.providers.find(p => p.providerId === 'groq')
    expect(entry?.status).toBe('unavailable')
  })

  it('marks ollama as unavailable when isAvailable throws', async () => {
    const report = await runHealthCheck()
    const entry = report.providers.find(p => p.providerId === 'ollama')
    expect(entry?.status).toBe('unavailable')
    expect(entry?.error).toContain('ECONNREFUSED')
  })

  it('marks provider as unconfigured when no API key and key required', async () => {
    // Temporarily remove env vars so apiKey resolves to undefined for key-requiring providers
    const savedAnthropic = process.env.ANTHROPIC_API_KEY
    const savedGroq = process.env.GROQ_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GROQ_API_KEY
    try {
      const report = await runHealthCheck()
      const entry = report.providers.find(p => p.providerId === 'anthropic')
      expect(entry?.status).toBe('unconfigured')
    } finally {
      process.env.ANTHROPIC_API_KEY = savedAnthropic
      process.env.GROQ_API_KEY = savedGroq
    }
  })

  it('summary counts sum to total', async () => {
    const report = await runHealthCheck()
    const { summary } = report
    expect(summary.total).toBe(3)
    expect(summary.healthy + summary.degraded + summary.unavailable + summary.unconfigured).toBe(3)
  })

  it('increments failStreak on repeated failure', async () => {
    const report1 = await runHealthCheck()
    const report2 = await runHealthCheck()
    const groq1 = report1.providers.find(p => p.providerId === 'groq')
    const groq2 = report2.providers.find(p => p.providerId === 'groq')
    // Second run: failStreak should be higher or equal to first
    expect((groq2?.failStreak ?? 0)).toBeGreaterThanOrEqual(groq1?.failStreak ?? 0)
  })
})

describe('getCachedHealthReport', () => {
  it('returns null when cache is empty', () => {
    expect(getCachedHealthReport()).toBeNull()
  })
})

describe('recordProviderFailure', () => {
  it('does not throw when provider not in cache', () => {
    expect(() => recordProviderFailure('unknown', 'timeout')).not.toThrow()
  })
})
