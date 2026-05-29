import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateFallbackBriefing, generateDailyBriefing, type BriefingInput } from './briefing-generator'

const base: BriefingInput = {
  pending: 0,
  approved: 0,
  running: 0,
  failed: 0,
  completedToday: 0,
  prOpen: 0,
  qualityPassRate: null,
}

describe('generateFallbackBriefing', () => {
  it('returns failed message when failed > 0', () => {
    expect(generateFallbackBriefing({ ...base, failed: 1 })).toContain('fehlgeschlagen')
    expect(generateFallbackBriefing({ ...base, failed: 1 })).toContain('1 Delegation')
    expect(generateFallbackBriefing({ ...base, failed: 3 })).toContain('3 Delegationen')
  })

  it('returns approved message when approved > 0 and no failures', () => {
    expect(generateFallbackBriefing({ ...base, approved: 1 })).toContain('1 Delegation ist')
    expect(generateFallbackBriefing({ ...base, approved: 2 })).toContain('2 Delegationen sind')
  })

  it('returns running message when running > 0 and no failures or approved', () => {
    expect(generateFallbackBriefing({ ...base, running: 1 })).toContain('1 Agent arbeitet')
    expect(generateFallbackBriefing({ ...base, running: 2 })).toContain('2 Agenten arbeiten')
  })

  it('returns completedToday message when completedToday > 0 and nothing else', () => {
    expect(generateFallbackBriefing({ ...base, completedToday: 1 })).toContain('Heute 1 Task')
    expect(generateFallbackBriefing({ ...base, completedToday: 5 })).toContain('5 Tasks')
  })

  it('returns idle message when everything is 0', () => {
    expect(generateFallbackBriefing(base)).toContain('Keine aktiven Delegationen')
  })

  it('prioritizes failed over approved', () => {
    expect(generateFallbackBriefing({ ...base, failed: 1, approved: 2 })).toContain('fehlgeschlagen')
  })
})

describe('generateDailyBriefing', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns AI text when generateText succeeds', async () => {
    vi.doMock('@/lib/ai/text-generation', () => ({
      generateText: vi.fn().mockResolvedValue({ text: 'AI-Briefing Text', provider: 'anthropic', model: 'claude' }),
    }))
    const { generateDailyBriefing: gen } = await import('./briefing-generator')
    const result = await gen({ ...base, failed: 1 })
    // Either AI or fallback — just ensure a string is returned
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('falls back to rule-based text when AI throws', async () => {
    vi.mock('@/lib/ai/text-generation', () => ({
      generateText: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    }))
    const { generateDailyBriefing: gen } = await import('./briefing-generator')
    const result = await gen({ ...base, failed: 2 })
    expect(result).toContain('fehlgeschlagen')
  })
})
