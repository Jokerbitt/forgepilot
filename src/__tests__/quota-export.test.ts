/**
 * Tests for:
 * - src/lib/quota/gemini-tracker.ts
 * - src/lib/project-briefs/markdown-export.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { QuotaStore } from '@/lib/quota/gemini-tracker'
import type { ProjectBrief } from '@/lib/models/project-brief'

let fakeFileContent: string | null = null

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((p: string) => p.endsWith('gemini-quota.json') ? fakeFileContent !== null : false),
    readFileSync: vi.fn(() => {
      if (fakeFileContent !== null) return fakeFileContent
      throw new Error('ENOENT: no such file')
    }),
    writeFileSync: vi.fn((_p: string, content: string) => { fakeFileContent = content }),
    mkdirSync: vi.fn(),
  },
}))

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeMinimalBrief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  const now = new Date().toISOString()
  return {
    id: 'brief-test-001',
    title: 'Mein Test-Projekt',
    status: 'in_review',
    createdAt: now,
    updatedAt: now,
    rawIdea: 'Eine interessante Idee f\u00fcr ein neues Produkt.',
    problemStatement: 'Nutzer haben M\u00fche, ihre Projekte zu organisieren.',
    targetAudience: 'Entwickler und Projektmanager',
    desiredOutcome: 'Ein \u00fcbersichtliches Tool f\u00fcr Projektplanung.',
    constraints: ['TypeScript only', 'No external auth'],
    scope: 'standard',
    researchMode: 'quick',
    privacyMode: 'local',
    requirements: [],
    useCases: [],
    nonGoals: ['Kein Mobile-Support'],
    risks: [],
    researchRunIds: [],
    researchBriefDraft: {
      title: 'Research: Mein Test-Projekt',
      mode: 'quick',
      privacyMode: 'local',
      preferredExecutor: 'agent',
      researchQuestions: ['Was gibt es schon?'],
      searchTerms: ['project-management', 'typescript'],
      preferredSourceTypes: ['web', 'github'],
      excludeCriteria: [],
    },
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
    incrementGeminiCall()
    incrementGeminiCall()
    incrementGeminiCall()
    expect(getGeminiQuota().today).toBe(3)
  })

  it('persists existing entries and only changes today', async () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    const seed: QuotaStore = { entries: [{ date: yesterdayStr, calls: 42 }], lastUpdated: yesterday.toISOString() }
    fakeFileContent = JSON.stringify(seed)
    const { incrementGeminiCall, getGeminiQuota, getGeminiQuotaHistory } = await import('@/lib/quota/gemini-tracker')
    incrementGeminiCall()
    expect(getGeminiQuota().today).toBe(1)
    const history = getGeminiQuotaHistory()
    expect(history.find(e => e.date === yesterdayStr)?.calls).toBe(42)
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

  it('returns a resetAt in the future (tomorrow UTC)', async () => {
    const { getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    const quota = getGeminiQuota()
    const resetAt = new Date(quota.resetAt)
    expect(resetAt.getTime()).toBeGreaterThan(Date.now())
    expect(resetAt.getUTCHours()).toBe(0)
    expect(resetAt.getUTCMinutes()).toBe(0)
  })

  it('caps percentage at 100 when at limit', async () => {
    fakeFileContent = JSON.stringify({ entries: [{ date: todayUTC(), calls: 1500 }], lastUpdated: new Date().toISOString() } as QuotaStore)
    const { getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    const quota = getGeminiQuota()
    expect(quota.percentage).toBe(100)
    expect(quota.today).toBe(1500)
  })
})

describe('briefToMarkdown', () => {
  it('generates valid markdown with the project title as h1', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    const md = briefToMarkdown(makeMinimalBrief({ title: 'Mein Super-Projekt' }))
    expect(md).toContain('# Mein Super-Projekt')
  })

  it('includes problemStatement, targetAudience and desiredOutcome sections', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    const brief = makeMinimalBrief()
    const md = briefToMarkdown(brief)
    expect(md).toContain('## Problemstellung')
    expect(md).toContain(brief.problemStatement)
    expect(md).toContain('## Zielgruppe')
    expect(md).toContain(brief.targetAudience)
  })

  it('includes constraints as list items', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    const md = briefToMarkdown(makeMinimalBrief({ constraints: ['TypeScript only', 'No external auth'] }))
    expect(md).toContain('## Randbedingungen')
    expect(md).toContain('- TypeScript only')
  })

  it('includes footer with brief id', async () => {
    const { briefToMarkdown } = await import('@/lib/project-briefs/markdown-export')
    const md = briefToMarkdown(makeMinimalBrief({ id: 'unique-brief-id-xyz' }))
    expect(md).toContain('unique-brief-id-xyz')
    expect(md).toContain('ForgePilot')
  })

  it('includes search terms in a code block when present', async () => {
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
    expect(md).toContain('## Problemstellung')
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
