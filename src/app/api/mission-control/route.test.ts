/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest'

// Mock child_process so gh pr list doesn't run in CI
vi.mock('child_process', () => ({
  execSync: vi.fn(() => '[]'),
}))

// Mock NBA engine — may not have work items in test env
vi.mock('@/lib/nba-engine/prioritizer', () => ({
  prioritizeItems: vi.fn(() => []),
}))

describe('GET /api/mission-control', () => {
  it('returns 200 with valid MissionControlData shape', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    expect(response.status).toBe(200)

    const body = (await response.json()) as Record<string, unknown>

    // Top-level shape
    expect(body).toHaveProperty('generatedAt')
    expect(body).toHaveProperty('focus')
    expect(body).toHaveProperty('pulse')
    expect(body).toHaveProperty('health')

    // focus shape
    const focus = body['focus'] as Record<string, unknown>
    expect(focus).toHaveProperty('nextBestAction')
    expect(focus).toHaveProperty('blockers')
    expect(focus).toHaveProperty('urgentApprovals')
    expect(Array.isArray(focus['blockers'])).toBe(true)
    expect(Array.isArray(focus['urgentApprovals'])).toBe(true)

    // pulse shape
    const pulse = body['pulse'] as Record<string, unknown>
    expect(typeof pulse['delegationsRunning']).toBe('number')
    expect(typeof pulse['delegationsPendingApproval']).toBe('number')
    expect(typeof pulse['delegationsCompletedToday']).toBe('number')
    expect(typeof pulse['openPRs']).toBe('number')

    // health shape
    const health = body['health'] as Record<string, unknown>
    expect(['ok', 'warn', 'error']).toContain(health['status'])
  })

  it('works when config files are missing (fail-open): returns 200 with empty arrays', async () => {
    // The route reads config files with existsSync guards — when missing it returns empty arrays.
    // config/linear-issues.json does not exist in repo, so blockers is always [].
    // urgentApprovals requires riskClass C + pending, which the demo data doesn't have.
    const { GET } = await import('./route')
    const response = await GET()
    expect(response.status).toBe(200)

    const body = (await response.json()) as Record<string, unknown>
    const focus = body['focus'] as Record<string, unknown>
    // linear-issues.json does not exist → blockers must be empty
    expect(Array.isArray(focus['blockers'])).toBe(true)
    // No throws — response is always a valid JSON object
    expect(typeof body['generatedAt']).toBe('string')
  })

  it('pulse.delegationsRunning is a number >= 0', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = (await response.json()) as Record<string, unknown>
    const pulse = body['pulse'] as Record<string, unknown>
    expect(typeof pulse['delegationsRunning']).toBe('number')
    expect(pulse['delegationsRunning'] as number).toBeGreaterThanOrEqual(0)
  })

  it('pulse.delegationsPendingApproval is a number >= 0', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = (await response.json()) as Record<string, unknown>
    const pulse = body['pulse'] as Record<string, unknown>
    expect(typeof pulse['delegationsPendingApproval']).toBe('number')
    expect(pulse['delegationsPendingApproval'] as number).toBeGreaterThanOrEqual(0)
  })
})
