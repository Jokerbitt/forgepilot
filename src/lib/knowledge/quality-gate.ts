/**
 * quality-gate.ts — JOK-187: Quality gate for knowledge writeback.
 *
 * Prevents noisy / duplicate cards from polluting the knowledge base.
 * All functions are pure and throw-free.
 */

export interface QualityResult {
  pass: boolean
  score: number   // 0–100
  reasons: string[]
}

const MIN_CONTENT_LENGTH = 60
const MIN_BULLET_COUNT   = 1

/**
 * Score LLM-generated content for suitability as a knowledge card.
 *
 * Scoring breakdown (100 pts total):
 *  40 — content length ≥ MIN_CONTENT_LENGTH chars (linear up to 300 chars)
 *  40 — contains markdown bullet points (- or * or numbered list)
 *  20 — title is specific (not generic fallback text)
 *
 * A score of ≥ 50 is required to pass.
 */
export function scoreKnowledgeContent(title: string, content: string): QualityResult {
  const reasons: string[] = []
  let score = 0

  // ── Length score (0–40) ────────────────────────────────────────────────────
  const len = content.trim().length
  if (len < MIN_CONTENT_LENGTH) {
    reasons.push(`Content too short (${len} chars, min ${MIN_CONTENT_LENGTH})`)
  } else {
    const lengthScore = Math.min(40, Math.round((len / 300) * 40))
    score += lengthScore
  }

  // ── Bullet point score (0–40) ─────────────────────────────────────────────
  const bulletPattern = /^[\s]*[-*]\s.+|^\d+\.\s.+/m
  const bulletCount   = (content.match(/^[\s]*[-*]\s.+|^\d+\.\s.+/gm) ?? []).length
  if (bulletCount < MIN_BULLET_COUNT || !bulletPattern.test(content)) {
    reasons.push('No structured bullet points found')
  } else {
    score += 40
  }

  // ── Title specificity score (0–20) ────────────────────────────────────────
  const genericTitles = [
    'raw execution output',
    'llm summary unavailable',
    'execution:',
    'report:',
    'unknown',
  ]
  const titleLower = title.toLowerCase()
  const isGeneric  = genericTitles.some(g => titleLower.startsWith(g))
  if (isGeneric) {
    reasons.push('Title appears to be a generic fallback')
  } else if (title.trim().length < 10) {
    reasons.push('Title too short')
  } else {
    score += 20
  }

  return {
    pass:    score >= 50,
    score:   Math.min(100, score),
    reasons,
  }
}

/**
 * Determine whether a new card should be written for the given delegation.
 *
 * Returns true only when:
 *  1. No existing card with the same sourceId exists (deduplication)
 *  2. Content passes quality scoring
 */
export function shouldWriteCard(
  title: string,
  content: string,
  existingSourceIds: string[],
  sourceId: string,
): { allow: boolean; reason?: string; qualityScore: number } {
  // Deduplication check
  if (existingSourceIds.includes(sourceId)) {
    return {
      allow:        false,
      reason:       'Card already exists for this delegation (duplicate)',
      qualityScore: 0,
    }
  }

  const quality = scoreKnowledgeContent(title, content)

  if (!quality.pass) {
    return {
      allow:        false,
      reason:       `Quality gate failed (score ${quality.score}/100): ${quality.reasons.join('; ')}`,
      qualityScore: quality.score,
    }
  }

  return { allow: true, qualityScore: quality.score }
}
