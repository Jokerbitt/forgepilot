import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock child_process so gh/git calls don't run in CI
vi.mock('child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes('gh pr list')) {
      return JSON.stringify([
        {
          number: 42,
          title: 'feat: add feature',
          url: 'https://github.com/org/repo/pull/42',
          author: { login: 'testuser' },
          updatedAt: new Date().toISOString(),
          isDraft: false,
        },
      ])
    }
    if (cmd.includes('gh api user')) {
      return 'testuser'
    }
    if (cmd.includes('git --version')) {
      return 'git version 2.40.0'
    }
    return ''
  }),
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '[]'),
  }
})

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({
    ANTHROPIC_API_KEY: 'sk-test-key',
    LINEAR_API_KEY: undefined,
  })),
}))

import { GET } from './route'
import type { BriefingData } from './route'

describe('GET /api/briefing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with valid BriefingData shape', async () => {
    const response = await GET()
    expect(response.status).toBe(200)

    const data = await response.json() as BriefingData

    expect(data).toHaveProperty('generatedAt')
    expect(typeof data.generatedAt).toBe('string')

    expect(data).toHaveProperty('linear')
    expect(Array.isArray(data.linear.inProgress)).toBe(true)
    expect(Array.isArray(data.linear.dueToday)).toBe(true)
    expect(Array.isArray(data.linear.blocked)).toBe(true)

    expect(data).toHaveProperty('github')
    expect(Array.isArray(data.github.openPRs)).toBe(true)
    expect(Array.isArray(data.github.myPRs)).toBe(true)

    expect(data).toHaveProperty('health')
    expect(['ok', 'warn', 'error']).toContain(data.health.overall)
    expect(typeof data.health.summary).toBe('string')

    expect(data).toHaveProperty('delegations')
    expect(typeof data.delegations.pendingApproval).toBe('number')
    expect(typeof data.delegations.inProgress).toBe('number')
    expect(typeof data.delegations.completedToday).toBe('number')
  })

  it('works when config files are missing (fail-open)', async () => {
    const { existsSync } = await import('fs')
    vi.mocked(existsSync).mockReturnValue(false)

    const response = await GET()
    const data = await response.json() as BriefingData

    // All linear sections must be empty arrays, not throws
    expect(data.linear.inProgress).toEqual([])
    expect(data.linear.dueToday).toEqual([])
    expect(data.linear.blocked).toEqual([])
  })

  it('delegation counts are numbers >= 0', async () => {
    const response = await GET()
    const data = await response.json() as BriefingData

    expect(data.delegations.pendingApproval).toBeGreaterThanOrEqual(0)
    expect(data.delegations.inProgress).toBeGreaterThanOrEqual(0)
    expect(data.delegations.completedToday).toBeGreaterThanOrEqual(0)
  })

  it('returns empty github data when gh CLI fails', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('gh pr list')) throw new Error('gh not found')
      if (cmd.includes('git --version')) return 'git version 2.40.0'
      return ''
    })

    const response = await GET()
    const data = await response.json() as BriefingData

    expect(response.status).toBe(200)
    expect(data.github.openPRs).toEqual([])
    expect(data.github.myPRs).toEqual([])
  })
})
