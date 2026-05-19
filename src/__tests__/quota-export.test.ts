import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { QuotaStore } from '@/lib/quota/gemini-tracker'
import type { ProjectBrief } from '@/lib/models/project-brief'

let fakeFileContent: string | null = null

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((p: string) => p.endsWith('gemini-quota.json') ? fakeFileContent !== null : false),
    readFileSync: vi.fn(() => {
      if (fakeFileContent !== null) return fakeFileContent
      throw new Error('ENOENT')
    }),
    writeFileSync: vi.fn((_p: string, content: string) => { fakeFileContent = content }),
    mkdirSync: vi.fn(),
  },
}))

function todayUTC(): string { return new Date().toISOString().slice(0, 10) }

function makeMinimalBrief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  const now = new Date().toISOString()
  return {
    id: 'brief-test-001', title: 'Mein Test-Projekt', status: 'in_review',
    createdAt: now, updatedAt: now,
    rawIdea: 'Eine interessante Idee.',
    problemStatement: 'Nutzer haben Probleme.',
    targetAudience: 'Entwickler', desiredOutcome: 'Besseres Tool.',
    constraints: ['TypeScript only', 'No external auth'],
    scope: 'standard', researchMode: 'quick', privacyMode: 'local',
    requirements: [], useCases: [], nonGoals: ['Kein Mobile'], risks: [], researchRunIds: [],
    researchBriefDraft: { title: 'Research', mode: 'quick', privacyMode: 'local', preferredExecutor: 'agent', researchQuestions: ['Was gibt es?'], searchTerms: ['project-management', 'typescript'], preferredSourceTypes: ['web', 'github'], excludeCriteria: [] },
    ...overrides,
  }
}

describe('gemini-tracker: incrementGeminiCall', () => {
  beforeEach(() => { fakeFileContent = null; vi.resetModules() })
  afterEach(() => { fakeFileContent = null })

  it('increments today counter from 0 to 1 on first call', async () => {
    const { incrementGeminiCall, getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    incrementGeminiCall()
    expect(getGeminiQuota().today).toBe(1)
  })

  it('increments counter correctly on multiple calls', async () => {
    const { incrementGeminiCall, getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    incrementGeminiCall(); incrementGeminiCall(); incrementGeminiCall()
    expect(getGeminiQuota().today).toBe(3)
  })

  it('persists existing entries and only changes today', async () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    fakeFileContent = JSON.stringify({ entries: [{ date: yesterdayStr, calls: 42 }], lastUpdated: yesterday.toISOString() } as QuotaStore)
    const { incrementGeminiCall, getGeminiQuota, getGeminiQuotaHistory } = await import('@/lib/quota/gemini-tracker')
    incrementGeminiCall()
    expect(getGeminiQuota().today).toBe(1)
    expect(getGeminiQuotaHistory().find(e => e.date === yesterdayStr)?.calls).toBe(42)
  })
})

describe('gemini-tracker: getGeminiQuota', () => {
  beforeEach(() => { fakeFileContent = null; vi.resetModules() })

  it('returns 0 calls with 0 percentage when no calls made', async () => {
    const { getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    const quota = getGeminiQuota()
    expect(quota.today).toBe(0)
    expect(quota.percentage).toBe(0)
    expect(quota.limit).toBe(1500)
  })

  it('calculates correct percentage for known call count', async () => {
    fakeFileContent = JSON.stringify({ entries: [{ date: todayUTC(), calls: 750 }], lastUpdated: new Date().toISOString() } as QuotaStore)
    const { getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    const quota = getGeminiQuota()
    expect(quota.today).toBe(750)
    expect(quota.percentage).toBe(50)
  })

  it('returns a resetAt in the future', async () => {
    const { getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    const quota = getGeminiQuota()
    const resetAt = new Date(quota.resetAt)
    expect(resetAt.getTime()).toBeGreaterThan(Date.now())
    expect(resetAt.getUTCHours()).toBe(0)
  })

  it('returns 100% when at limit', async () => {
    fakeFileContent = JSON.stringify({ entries: [{ date: todayUTC(), calls: 1500 }], lastUpdated: new Date().toISOString() } as QuotaStore)
    const { getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    expect(getGeminiQuota().percentage).toBe(100)
  })
})

describe('briefToMarkdown', () => {
  it('generates valid markdown with the project title as h1', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    expect(briefToMarkdown(makeMinimalBrief({ title: 'Mein Super-Projekt' }))).toContain('# Mein Super-Projekt')
  })

  it('includes key sections', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    const brief = makeMinimalBrief()
    const md = briefToMarkdown(brief)
    expect(md).toContain('## Problemstellung')
    expect(md).toContain(brief.problemStatement)
    expect(md).toContain('## Zielgruppe')
  })

  it('includes constraints as list items', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    const md = briefToMarkdown(makeMinimalBrief({ constraints: ['TypeScript only', 'No external auth'] }))
    expect(md).toContain('## Randbedingungen')
    expect(md).toContain('- TypeScript only')
  })

  it('includes footer with brief id', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    expect(briefToMarkdown(makeMinimalBrief({ id: 'unique-brief-id-xyz' }))).toContain('unique-brief-id-xyz')
  })

  it('includes search terms in a code block', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    const md = briefToMarkdown(makeMinimalBrief())
    expect(md).toContain('```')
    expect(md).toContain('project-management')
  })

  it('omits empty sections gracefully', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    const brief = makeMinimalBrief({
      constraints: [], nonGoals: [], requirements: [], useCases: [], risks: [],
      researchBriefDraft: { title: '', mode: 'quick', privacyMode: 'local', preferredExecutor: 'agent', researchQuestions: [], searchTerms: [], preferredSourceTypes: [], excludeCriteria: [] },
    })
    const md = briefToMarkdown(brief)
    expect(md).toContain('# ')
    expect(md).not.toContain('## Randbedingungen')
    expect(md).not.toContain('## Research Brief')
  })
})

describe('briefMarkdownFilename', () => {
  it('generates a slug-based filename with .md extension', async () => {
    const { briefMarkdownFilename } = await import('@/lib/project-briefs/markdown-export')
    const filename = briefMarkdownFilename(makeMinimalBrief({ title: 'Mein Test-Projekt' }))
    expect(filename).toMatch(/^brief-/)
    expect(filename).toMatch(/\.md$/)
    expect(filename).not.toContain(' ')
  })
})
