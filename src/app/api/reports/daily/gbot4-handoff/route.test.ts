import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scrubSecrets, containsSecretPattern } from '@/lib/reports/scrub-secrets'

// ---------------------------------------------------------------------------
// Unit tests for scrubSecrets utility
// ---------------------------------------------------------------------------

describe('scrubSecrets', () => {
  it('redacts Anthropic-style sk- keys', () => {
    const input = 'key: sk-ant-api123456789012345678901234567890'
    const result = scrubSecrets(input)
    expect(result).not.toMatch(/sk-ant/)
    expect(result).toContain('[API_KEY_REDACTED]')
  })

  it('redacts xAI-style xai- keys', () => {
    // Standalone xai- key (no prefix env var)
    const input = 'token: xai-abcdefghijklmnopqrstuvwxyz123456'
    const result = scrubSecrets(input)
    expect(result).not.toMatch(/xai-[a-zA-Z0-9]/)
    // Either form of redaction is acceptable
    expect(result).toMatch(/\[(?:API_KEY_|)REDACTED\]/)
  })

  it('redacts generic key=value patterns', () => {
    const cases = [
      'api_key: myverylongsecretvalue',
      'token=eyJhbGciOiJIUzI1NiJ9.payload',
      'password: hunter2password',
    ]
    for (const c of cases) {
      const result = scrubSecrets(c)
      expect(result).not.toContain(c)
      expect(result).toContain('[REDACTED]')
    }
  })

  it('leaves plain text untouched', () => {
    const input = 'Executive Verdict: GREEN — all systems nominal.'
    expect(scrubSecrets(input)).toBe(input)
  })

  it('leaves valid issue IDs untouched', () => {
    const input = 'Linear issues: JOK-172, FP-3 need attention.'
    expect(scrubSecrets(input)).toBe(input)
  })
})

// ---------------------------------------------------------------------------
// containsSecretPattern helper
// ---------------------------------------------------------------------------

describe('containsSecretPattern', () => {
  it('detects sk- keys', () => {
    expect(containsSecretPattern('sk-ant-api123456789012345678901234567890')).toBe(true)
  })

  it('detects xai- keys', () => {
    expect(containsSecretPattern('xai-abcdefghijklmnopqrstuvwxyz123456')).toBe(true)
  })

  it('returns false for clean text', () => {
    expect(containsSecretPattern('Executive Verdict: GREEN')).toBe(false)
    expect(containsSecretPattern('JOK-172')).toBe(false)
    expect(containsSecretPattern('score: 8')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Handoff package integration: mock buildDailyReport + test shape
// ---------------------------------------------------------------------------

vi.mock('@/lib/reports/daily-report', () => ({
  buildDailyReport: vi.fn(() => ({
    version: 1,
    generatedAt: '2026-05-21T10:00:00.000Z',
    period: 'daily',
    executiveVerdict: { status: 'green', summary: 'All good.' },
    status: {
      delegations: { total: 2, pending: 1, approved: 0, running: 0, completed: 1, failed: 0, cancelled: 0 },
      projectBriefs: { total: 1, accepted: 1, inReview: 0, draft: 0 },
      quality: { completedDelegations: 1, criticScoresStored: 1, criticCoveragePct: 100, prsCreated: 1, knowledgeCards: 2, knowledgeWritebacks: 1 },
      operations: { openAttentionItems: 0, staleRunningDelegations: 0, storageMode: 'json', authDisabled: false },
    },
    risks: [],
    nextActions: [],
    prompts: [],
    markdown: '# ForgePilot Daily Report\n\nGenerated: 2026-05-21T10:00:00.000Z\n\n## Executive Verdict\nGREEN: All good.\n\n## Status\n- Delegations: 2 total, 1 completed, 0 failed, 0 running\n',
  })),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(() => ({
    listByStatus: vi.fn(async () => [
      { id: 'del-1', title: 'Test Delegation', status: 'pending', createdAt: '2026-05-20T08:00:00.000Z' },
      { id: 'del-2', title: 'Done Delegation', status: 'completed', createdAt: '2026-05-19T08:00:00.000Z' },
    ]),
  })),
  getDelegationStorageMode: vi.fn(() => 'json'),
  SINGLE_TENANT_USER_ID: 'single-tenant',
}))

vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: vi.fn(() => ({
    listAll: vi.fn(async () => []),
  })),
}))

vi.mock('@/lib/repositories/projectBriefRepository', () => ({
  createProjectBriefRepository: vi.fn(() => ({
    listAll: vi.fn(async () => []),
  })),
}))

vi.mock('@/lib/attention/store', () => ({
  getOpenAttentionItems: vi.fn(() => []),
}))

describe('GET /api/reports/daily/gbot4-handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a valid handoff package shape', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json() as Record<string, unknown>

    // Required top-level fields
    expect(typeof body.generatedAt).toBe('string')
    expect(typeof body.promptTemplate).toBe('string')
    expect(typeof body.reportMarkdown).toBe('string')
    expect(typeof body.instructions).toBe('string')
    expect(typeof body.safeContext).toBe('object')
  })

  it('promptTemplate contains {REPORT_MARKDOWN} placeholder — actually embeds the report', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json() as Record<string, unknown>

    // The template should embed the actual report (not a placeholder token after build)
    expect(typeof body.promptTemplate).toBe('string')
    const template = body.promptTemplate as string
    // Should contain the daily report section header
    expect(template).toContain('## Daily Report')
    // Should contain actual report content
    expect(template).toContain('ForgePilot Daily Report')
  })

  it('response does NOT contain API key patterns', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const text = await response.text()

    // Must not contain actual secret values (sk- or xai- key tokens)
    expect(containsSecretPattern(text)).toBe(false)
    // Must not contain env-var assignments with values (e.g. ANTHROPIC_API_KEY=sk-xxx)
    expect(text).not.toMatch(/ANTHROPIC_API_KEY\s*[:=]\s*sk-/)
    expect(text).not.toMatch(/LINEAR_API_KEY\s*[:=]\s*\S+/)
    expect(text).not.toMatch(/XAI_API_KEY\s*[:=]\s*xai-/)
    expect(text).not.toMatch(/NEXTAUTH_SECRET\s*[:=]\s*\S+/)
  })

  it('safeContext.openLinearIssues contains only Issue-ID strings', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json() as { safeContext: { openLinearIssues: unknown[] } }

    const issues = body.safeContext.openLinearIssues
    expect(Array.isArray(issues)).toBe(true)

    // All entries must match the Issue-ID pattern: letters + digits, dash, digits
    for (const issue of issues) {
      expect(typeof issue).toBe('string')
      expect(issue as string).toMatch(/^[A-Z][A-Z0-9]+-\d+$/)
    }
  })

  it('safeContext.activeDelegations and pendingApprovals are numbers', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json() as { safeContext: { activeDelegations: unknown; pendingApprovals: unknown } }

    expect(typeof body.safeContext.activeDelegations).toBe('number')
    expect(typeof body.safeContext.pendingApprovals).toBe('number')
  })
})
