/**
 * brief-critic/index.ts — M218
 * Critic LLM that reviews project briefs and suggests 3 improvements.
 */
import { generateText } from '@/lib/ai/text-generation'
import type { ProjectBrief } from '@/lib/models/project-brief'
import { apiLogger } from '@/lib/logger'
import type { CriticReview } from './types'

export type { CriticVerdict, CriticSuggestion, CriticReview } from './types'

const CRITIC_SYSTEM = `You are a product requirements critic for a software development AI system.
Your job: review project briefs and identify weaknesses. Be specific and constructive.
You ALWAYS respond with valid JSON only. No markdown code blocks, no prose outside JSON.`

function buildCriticPrompt(brief: ProjectBrief): string {
  return `Review this project brief and respond with JSON:

Title: ${brief.title}
Raw Idea: ${brief.rawIdea}
Problem Statement: ${brief.problemStatement}
Target Audience: ${brief.targetAudience}
Desired Outcome: ${brief.desiredOutcome}
Constraints: ${brief.constraints.join(', ') || 'none'}
Scope: ${brief.scope}

JSON schema:
{
  "verdict": "approved" | "needs_improvement",
  "issues": ["issue 1"],
  "strengths": ["strength 1"],
  "suggestions": [
    { "id": "option_a", "title": "...", "summary": "...", "patch": { "problemStatement": "improved text" } },
    { "id": "option_b", "title": "...", "summary": "...", "patch": { "targetAudience": "improved text" } },
    { "id": "option_c", "title": "...", "summary": "...", "patch": { "desiredOutcome": "improved text" } }
  ]
}

Rules:
- If approved: issues=[], suggestions=[]
- If needs_improvement: exactly 3 suggestions, each with a different focus
- patch contains ONLY changed fields with the actual improved text
- Keep text in same language as the brief
- Suggestions must be meaningfully different from each other`
}

function parseReview(text: string): Omit<CriticReview, 'reviewedAt'> | null {
  try {
    const jsonMatch = /\{[\s\S]*\}/.exec(text)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Omit<CriticReview, 'reviewedAt'>
    if (!parsed.verdict || !Array.isArray(parsed.issues) || !Array.isArray(parsed.suggestions)) return null
    return parsed
  } catch {
    return null
  }
}

export async function reviewBrief(brief: ProjectBrief): Promise<CriticReview> {
  const reviewedAt = new Date().toISOString()
  try {
    const result = await generateText({
      system: CRITIC_SYSTEM,
      prompt: buildCriticPrompt(brief),
      maxTokens: 1500,
      purpose: 'fast',
    })
    const parsed = parseReview(result.text)
    if (!parsed) {
      apiLogger.warn({ event: 'brief.critic.parse_failed', briefId: brief.id })
      return { verdict: 'approved', issues: [], strengths: ['Kritik nicht auswertbar'], suggestions: [], reviewedAt }
    }
    if (parsed.verdict === 'needs_improvement') {
      parsed.suggestions = parsed.suggestions.slice(0, 3)
    }
    apiLogger.info({ event: 'brief.critic.reviewed', briefId: brief.id, verdict: parsed.verdict })
    return { ...parsed, reviewedAt }
  } catch (err) {
    apiLogger.warn({ event: 'brief.critic.failed', briefId: brief.id, error: String(err) })
    return { verdict: 'approved', issues: [], strengths: ['Kritik nicht verfügbar'], suggestions: [], reviewedAt }
  }
}
