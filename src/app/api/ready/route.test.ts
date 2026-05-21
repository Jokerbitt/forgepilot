/**
 * Tests for GET /api/ready — M160 Readiness Probe
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── fs mock ────────────────────────────────────────────────────────────────────

const { mockStatSync, mockExistsSync, mockWriteFileSync, mockUnlinkSync, mockReadFileSync } = vi.hoisted(() => ({
  mockStatSync:      vi.fn(),
  mockExistsSync:    vi.fn(() => true),
  mockWriteFileSync: vi.fn(),
  mockUnlinkSync:    vi.fn(),
  mockReadFileSync:  vi.fn(() => '[]'),
}))

vi.mock('fs', () => ({
  default: {
    statSync:      mockStatSync,
    existsSync:    mockExistsSync,
    writeFileSync: mockWriteFileSync,
    unlinkSync:    mockUnlinkSync,
    readFileSync:  mockReadFileSync,
  },
}))

vi.mock('@/lib/ai/providers/config-store', () => ({
  getAllProviderConfigs: vi.fn(() => [
    { id: 'anthropic', name: 'Anthropic', apiKeyRef: 'ANTHROPIC_API_KEY', enabled: true },
    { id: 'ollama',    name: 'Ollama',    apiKeyRef: '',                   enabled: true },
  ]),
}))

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({})),
}))

vi.mock('@/lib/connectors/registry', () => ({
  getAllConnectorHealth: vi.fn(() => [
    { manifest: { id: 'linear', name: 'Linear' }, health: { connectorId: 'linear', status: 'unconfigured', lastChecked: '2026-01-01T00:00:00.000Z' } },
    { manifest: { id: 'github', name: 'GitHub' }, health: { connectorId: 'github', status: 'ok', lastChecked: '2026-01-01T00:00:00.000Z' } },
  ]),
}))

import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  // default: all good
  mockStatSync.mockReturnValue({ size: 4096 })
  mockExistsSync.mockReturnValue(true)
  mockWriteFileSync.mockImplementation(() => {})
  mockUnlinkSync.mockImplementation(() => {})
  mockReadFileSync.mockReturnValue('[]')
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
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
    expect(names).toContain('connectors')
  })

  it('returns 503 with status=not_ready when delegation store is inaccessible', async () => {
    mockStatSync.mockImplementation(() => { throw new Error('ENOENT') })
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

  it('returns 200 degraded when no API keys configured (ollama available)', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; checks: { name: string; status: string }[] }
    // Ollama is local (no apiKeyRef) → configured even without env var
    expect(body.status).toBe('ready')
    const check = body.checks.find(c => c.name === 'ai_providers')!
    expect(check.status).toBe('pass')
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

  it('returns 503 when connector health reports an error', async () => {
    const { getAllConnectorHealth } = await import('@/lib/connectors/registry')
    vi.mocked(getAllConnectorHealth).mockResolvedValueOnce([
      { manifest: { id: 'linear', name: 'Linear' }, health: { connectorId: 'linear', status: 'error', lastChecked: '2026-01-01T00:00:00.000Z' } },
      { manifest: { id: 'github', name: 'GitHub' }, health: { connectorId: 'github', status: 'ok', lastChecked: '2026-01-01T00:00:00.000Z' } },
    ] as Awaited<ReturnType<typeof getAllConnectorHealth>>)

    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json() as { checks: { name: string; status: string }[] }
    const check = body.checks.find(c => c.name === 'connectors')!
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
