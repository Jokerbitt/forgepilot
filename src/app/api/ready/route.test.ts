/**
 * Tests for GET /api/ready — M160 Readiness Probe
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Repository mock ────────────────────────────────────────────────────────────

const mockListByStatus = vi.fn().mockResolvedValue([])

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(() => ({
    listByStatus: mockListByStatus,
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listByProject: vi.fn(),
  })),
  SINGLE_TENANT_USER_ID: 'local-user',
}))

// ── fs mock ────────────────────────────────────────────────────────────────────

const { mockExistsSync, mockWriteFileSync, mockUnlinkSync, mockReadFileSync } = vi.hoisted(() => ({
  mockExistsSync:    vi.fn(() => true),
  mockWriteFileSync: vi.fn(),
  mockUnlinkSync:    vi.fn(),
  mockReadFileSync:  vi.fn(() => '[]'),
}))

vi.mock('fs', () => ({
  default: {
    existsSync:    mockExistsSync,
    writeFileSync: mockWriteFileSync,
    unlinkSync:    mockUnlinkSync,
    readFileSync:  mockReadFileSync,
  },
}))

const { mockGetProviderAvailability, mockResolveProvider } = vi.hoisted(() => ({
  mockGetProviderAvailability: vi.fn(),
  mockResolveProvider: vi.fn(),
}))

vi.mock('@/lib/ai/auto-router', () => ({
  getProviderAvailability: mockGetProviderAvailability,
  resolveProvider: mockResolveProvider,
}))

vi.mock('@/lib/auth/config', () => ({
  getAuthSecurityIssues: vi.fn(() => []),
  isProductionRuntime:   vi.fn(() => false),
}))

import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  // default: all good
  mockListByStatus.mockResolvedValue([])
  mockExistsSync.mockReturnValue(true)
  mockWriteFileSync.mockImplementation(() => {})
  mockUnlinkSync.mockImplementation(() => {})
  mockReadFileSync.mockReturnValue('[]')
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
  mockGetProviderAvailability.mockResolvedValue([
    {
      id: 'anthropic',
      name: 'Anthropic',
      available: true,
      status: 'connected',
      isFree: false,
      isLocal: false,
      model: 'claude-haiku-4-5',
    },
    {
      id: 'ollama',
      name: 'Ollama',
      available: false,
      status: 'local-offline',
      isFree: true,
      isLocal: true,
      model: 'none',
    },
  ])
  mockResolveProvider.mockResolvedValue({
    mode: 'auto',
    providerId: 'anthropic',
    model: 'claude-haiku-4-5',
    isFree: false,
    isLocal: false,
    reason: 'auto: ANTHROPIC_API_KEY present',
  })
})

describe('GET /api/ready', () => {
  it('returns 200 with status=ready when all checks pass', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; checks: { name: string; status: string }[] }
    expect(body.status).toBe('ready')
    expect(body.checks).toHaveLength(5)
  })

  it('includes all check names', async () => {
    const res = await GET()
    const body = await res.json() as { checks: { name: string }[] }
    const names = body.checks.map(c => c.name)
    expect(names).toContain('delegation_store')
    expect(names).toContain('ai_providers')
    expect(names).toContain('scope_lock')
    expect(names).toContain('notification_store')
    expect(names).toContain('auth_security')
  })

  it('returns 503 with status=not_ready when delegation store is inaccessible', async () => {
    mockListByStatus.mockRejectedValue(new Error('DB connection failed'))
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json() as { status: string; checks: { name: string; status: string }[] }
    expect(body.status).toBe('not_ready')
    const check = body.checks.find(c => c.name === 'delegation_store')!
    expect(check.status).toBe('fail')
  })

  it('returns 503 when scope lock dir is not writable', async () => {
    mockWriteFileSync.mockImplementation(() => { throw new Error('EACCES') })
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('not_ready')
  })

  it('returns ready when no API keys are configured but Ollama is running', async () => {
    delete process.env.ANTHROPIC_API_KEY
    mockGetProviderAvailability.mockResolvedValue([
      {
        id: 'anthropic',
        name: 'Anthropic',
        available: false,
        status: 'missing',
        isFree: false,
        isLocal: false,
        model: 'claude-haiku-4-5',
        reason: 'ANTHROPIC_API_KEY not configured',
      },
      {
        id: 'ollama',
        name: 'Ollama',
        available: true,
        status: 'connected',
        isFree: true,
        isLocal: true,
        model: 'qwen2.5-coder:14b',
      },
    ])
    mockResolveProvider.mockResolvedValue({
      mode: 'auto',
      providerId: 'ollama',
      model: 'qwen2.5-coder:14b',
      isFree: true,
      isLocal: true,
      reason: 'auto: Ollama running with model "qwen2.5-coder:14b"',
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; checks: { name: string; status: string }[] }
    expect(body.status).toBe('ready')
    const check = body.checks.find(c => c.name === 'ai_providers')!
    expect(check.status).toBe('pass')
  })

  it('returns degraded when no provider is actually available', async () => {
    mockGetProviderAvailability.mockResolvedValue([
      {
        id: 'anthropic',
        name: 'Anthropic',
        available: false,
        status: 'missing',
        isFree: false,
        isLocal: false,
        model: 'claude-haiku-4-5',
        reason: 'ANTHROPIC_API_KEY not configured',
      },
      {
        id: 'ollama',
        name: 'Ollama',
        available: false,
        status: 'local-offline',
        isFree: true,
        isLocal: true,
        model: 'none',
        reason: 'Ollama is not running',
      },
    ])
    mockResolveProvider.mockResolvedValue({
      mode: 'auto',
      providerId: 'placeholder',
      model: 'none',
      isFree: true,
      isLocal: true,
      reason: 'no provider available',
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; checks: { name: string; status: string; message: string }[] }
    expect(body.status).toBe('degraded')
    const check = body.checks.find(c => c.name === 'ai_providers')!
    expect(check.status).toBe('warn')
    expect(check.message).toContain('0/2 providers available')
  })

  it('returns 200 degraded when notification store is missing (fresh install)', async () => {
    mockExistsSync.mockImplementation((...args: unknown[]) => !String(args[0]).includes('notifications.json'))
    const res = await GET()
    expect(res.status).toBe(200) // warn = degraded, not 503
    const body = await res.json() as { status: string; checks: { name: string; status: string }[] }
    expect(body.status).toBe('degraded')
    const check = body.checks.find(c => c.name === 'notification_store')!
    expect(check.status).toBe('warn')
  })

  it('returns 503 when notification store has invalid JSON', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes('notifications.json')) return 'NOT_JSON'
      return '[]'
    })
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json() as { checks: { name: string; status: string }[] }
    const check = body.checks.find(c => c.name === 'notification_store')!
    expect(check.status).toBe('fail')
  })

  it('includes durationMs in each check', async () => {
    const res = await GET()
    const body = await res.json() as { checks: { durationMs: number }[]; durationMs: number }
    for (const c of body.checks) {
      expect(typeof c.durationMs).toBe('number')
      expect(c.durationMs).toBeGreaterThanOrEqual(0)
    }
    expect(typeof body.durationMs).toBe('number')
  })

  it('includes ISO timestamp', async () => {
    const res = await GET()
    const body = await res.json() as { timestamp: string }
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
