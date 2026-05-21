import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai/text-generation', () => ({
  generateText: vi.fn(async () => ({
    text: JSON.stringify({
      verdict: 'needs_improvement',
      issues: ['Problem statement is too vague'],
      strengths: ['Clear title'],
      suggestions: [
        { id: 'option_a', title: 'Option A', summary: 'Better problem', patch: { problemStatement: 'Users cannot export delegation data.' } },
        { id: 'option_b', title: 'Option B', summary: 'Narrower audience', patch: { targetAudience: 'Project managers with 5+ delegations/week' } },
        { id: 'option_c', title: 'Option C', summary: 'Measurable outcome', patch: { desiredOutcome: 'CSV export in under 2 seconds' } },
      ],
    }),
    provider: 'anthropic', model: 'claude-haiku',
  })),
}))

vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn() } }))

const mockBrief = {
  id: 'b1', title: 'Test', status: 'in_review' as const,
  createdAt: '', updatedAt: '',
  rawIdea: 'Something for everyone in the system',
  problemStatement: 'There is a problem',
  targetAudience: 'everyone',
  desiredOutcome: 'better experience',
  constraints: [], scope: 'standard' as const,
  researchMode: 'standard' as const, privacyMode: 'local' as const,
  requirements: [], useCases: [], nonGoals: [], risks: [], researchRunIds: [],
  researchBriefDraft: {
    title: 'Test',
    mode: 'standard' as const,
    privacyMode: 'local' as const,
    preferredExecutor: 'agent' as const,
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
}

describe('reviewBrief', () => {
  it('returns 3 suggestions when LLM finds issues', async () => {
    const { reviewBrief } = await import('./index')
    const review = await reviewBrief(mockBrief as Parameters<typeof reviewBrief>[0])
    expect(review.verdict).toBe('needs_improvement')
    expect(review.suggestions).toHaveLength(3)
    expect(review.suggestions[0].id).toBe('option_a')
    expect(review.reviewedAt).toBeTruthy()
  })

  it('fails open when LLM returns garbage', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'not json at all', provider: 'x', model: 'y' })
    const { reviewBrief } = await import('./index')
    const review = await reviewBrief(mockBrief as Parameters<typeof reviewBrief>[0])
    expect(review.verdict).toBe('approved')
    expect(review.suggestions).toHaveLength(0)
  })

  it('fails open when generateText throws', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockRejectedValueOnce(new Error('Network error'))
    const { reviewBrief } = await import('./index')
    const review = await reviewBrief(mockBrief as Parameters<typeof reviewBrief>[0])
    expect(review.verdict).toBe('approved')
  })
})
