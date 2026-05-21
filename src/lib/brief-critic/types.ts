/**
 * brief-critic/types.ts — M218
 * Shared types for the Critic LLM feature.
 * Kept separate to avoid circular imports between brief-critic and project-brief model.
 */

export type CriticVerdict = 'approved' | 'needs_improvement'

export interface CriticSuggestion {
  id: string           // 'option_a' | 'option_b' | 'option_c'
  title: string        // Short label e.g. "Schärferes Problem-Statement"
  summary: string      // 1 sentence why this improves the brief
  patch: Partial<{
    rawIdea: string
    problemStatement: string
    targetAudience: string
    desiredOutcome: string
    constraints: string[]
  }>
}

export interface CriticReview {
  verdict: CriticVerdict
  issues: string[]
  strengths: string[]
  suggestions: CriticSuggestion[]
  appliedSuggestionId?: string
  reviewedAt: string
}
