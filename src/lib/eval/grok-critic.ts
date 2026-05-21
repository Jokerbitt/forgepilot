/**
 * Grok Critic — Dual-LLM evaluation layer
 *
 * Sends delegation output to Grok (xAI) for an independent second opinion.
 * Result is merged with the primary score from scoreOutput() to produce a
 * more robust, less single-model-biased evaluation.
 *
 * Usage:
 *   const criticResult = await runGrokCritic({ delegation, output, criteria })
 *   if (criticResult) mergeWithPrimaryScore(primaryScore, criticResult)
 */

import { generateText, stripJsonCodeFence, type GenerateTextResult } from '@/lib/ai/text-generation'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'grok-critic' })

const DEFAULT_LOCAL_CRITIC_MODEL = 'qwen2.5-coder:14b'

interface CriticProviderCandidate {
  providerId: string
  model?: string
}

function getCriticProviderCandidates(): CriticProviderCandidate[] {
  const configuredProvider = process.env.FORGEPILOT_CRITIC_PROVIDER?.trim()
  const configuredModel = process.env.FORGEPILOT_CRITIC_MODEL?.trim()
  const candidates: CriticProviderCandidate[] = []

  if (configuredProvider) {
    candidates.push({ providerId: configuredProvider, model: configuredModel || undefined })
  }

  candidates.push(
    { providerId: 'xai' },
    { providerId: 'ollama', model: configuredModel || DEFAULT_LOCAL_CRITIC_MODEL },
  )

  const seen = new Set<string>()
  return candidates.filter(candidate => {
    const key = `${candidate.providerId}:${candidate.model ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function generateCriticJson(options: {
  system: string
  prompt: string
  maxTokens: number
  event: string
}) {
  let lastError: unknown

  for (const candidate of getCriticProviderCandidates()) {
    try {
      return await generateText({
        system: options.system,
        prompt: options.prompt,
        purpose: 'fast',
        providerId: candidate.providerId,
        anthropicModel: candidate.model,
        maxTokens: options.maxTokens,
      })
    } catch (err) {
      lastError = err
      log.warn({
        event: options.event,
        providerId: candidate.providerId,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'No critic provider available'))
}

async function generateParsedCriticJson<T>(options: {
  system: string
  prompt: string
  maxTokens: number
  event: string
  parseEvent: string
}): Promise<{ parsed: T; result: GenerateTextResult }> {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = attempt === 0
      ? options.prompt
      : `${options.prompt}

Your previous response was invalid JSON. Retry with compact JSON only. Escape all quotes inside strings. Do not include markdown fences or commentary.`

    const result = await generateCriticJson({
      system: options.system,
      prompt,
      maxTokens: options.maxTokens,
      event: options.event,
    })

    try {
      return {
        parsed: JSON.parse(stripJsonCodeFence(result.text)) as T,
        result,
      }
    } catch (err) {
      lastError = err
      log.warn({
        event: options.parseEvent,
        providerId: result.provider,
        attempt: attempt + 1,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Critic returned invalid JSON'))
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrokCriticInput {
  delegationTitle: string
  delegationContract: string
  acceptanceCriteria: string[]
  agentOutput: string
  /** Optional: list of files changed (for drift detection) */
  filesChanged?: string[]
}

export interface GrokCriticResult {
  correctnessScore: number
  efficiencyScore: number
  driftScore: number
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  criteriaHit: boolean[]
  issues: string[]
  verdict: 'PASS' | 'FAIL' | 'NEEDS_REVISION'
  reason: string
  /** Raw response from Grok for debugging */
  rawResponse?: string
  /** Provider used (always 'xai' unless fallback) */
  providerId: string
  /** Timestamp */
  evaluatedAt: string
}

export interface CodeReviewInput {
  filePath: string
  fileContent: string
  /** Optional diff context */
  diff?: string
  /** What this file is supposed to do */
  purpose?: string
}

export interface CodeReviewResult {
  securityIssues: Array<{ severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; issue: string; fix: string }>
  correctnessIssues: Array<{ type: 'BUG' | 'EDGE_CASE' | 'TYPE_ISSUE'; issue: string; fix: string }>
  verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'BLOCK'
  summary: string
  rawResponse?: string
  providerId: string
  reviewedAt: string
}

// ─── System prompt ────────────────────────────────────────────────────────────

const CRITIC_SYSTEM_PROMPT = `You are Grok-Critic, the quality gate for ForgePilot — an AI Workflow OS (Next.js 15, TypeScript strict, file-based JSON stores, Vitest).

Your job: evaluate agent output honestly. Be direct. Flag real problems. Do not soften feedback.

Rules:
- Never use "any" type (project bans it)
- All API routes must use parseBody() with Zod schemas
- File writes to config/*.json must handle race conditions
- No secrets in logs or responses
- Missing error handling for fs operations is always a bug

Respond ONLY with valid JSON matching the schema provided in the user message. No markdown, no prose outside the JSON.`

const CODE_REVIEW_SYSTEM_PROMPT = `You are Grok-Critic, a security-focused code reviewer for ForgePilot (Next.js 15 TypeScript app).

Review for: unsanitized paths, missing Zod validation, race conditions in JSON file writes, any types, SSRF, PII in logs, missing auth checks.

Respond ONLY with valid JSON. No markdown fences. No prose.`

// ─── Delegation output evaluator ──────────────────────────────────────────────

/**
 * Send delegation output to a critic provider for scoring.
 * Prefers Grok/xAI, then falls back to local Ollama for local-first coverage.
 */
export async function runGrokCritic(input: GrokCriticInput): Promise<GrokCriticResult | null> {
  const criteriaList = input.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
  const filesInfo = input.filesChanged?.length
    ? `\nFiles changed: ${input.filesChanged.join(', ')}`
    : ''

  const prompt = `Evaluate this delegation output.

DELEGATION: ${input.delegationTitle}
CONTRACT: ${input.delegationContract}

ACCEPTANCE CRITERIA:
${criteriaList}
${filesInfo}

AGENT OUTPUT:
${input.agentOutput.slice(0, 6000)}

Respond with JSON exactly matching this schema:
{
  "correctnessScore": number (0-100, did output meet all criteria?),
  "efficiencyScore": number (0-100, is solution appropriately sized?),
  "driftScore": number (0-100, did agent stay in scope? 100=perfect focus),
  "overallGrade": "A"|"B"|"C"|"D"|"F",
  "criteriaHit": boolean[] (one entry per criterion above),
  "issues": string[] (specific problems found, empty if none),
  "verdict": "PASS"|"FAIL"|"NEEDS_REVISION",
  "reason": string (one honest paragraph)
}`

  try {
    const { parsed, result } = await generateParsedCriticJson<Omit<GrokCriticResult, 'providerId' | 'evaluatedAt' | 'rawResponse'>>({
      system: CRITIC_SYSTEM_PROMPT,
      prompt,
      maxTokens: 1000,
      event: 'grok.critic.provider_failed',
      parseEvent: 'grok.critic.invalid_json',
    })

    log.info({
      event: 'grok.critic.eval',
      delegation: input.delegationTitle,
      providerId: result.provider,
      verdict: parsed.verdict,
      grade: parsed.overallGrade,
    })

    return {
      ...parsed,
      rawResponse: result.text,
      providerId: result.provider,
      evaluatedAt: new Date().toISOString(),
    }
  } catch (err) {
    log.warn({ event: 'grok.critic.unavailable', reason: err instanceof Error ? err.message : String(err) })
    return null
  }
}

// ─── Code reviewer ────────────────────────────────────────────────────────────

/**
 * Ask the critic to review a single file for security + correctness issues.
 * Prefers Grok/xAI, then falls back to local Ollama for local-first coverage.
 */
export async function runGrokCodeReview(input: CodeReviewInput): Promise<CodeReviewResult | null> {
  const diffSection = input.diff ? `\nDIFF:\n${input.diff.slice(0, 3000)}` : ''
  const purposeSection = input.purpose ? `\nPURPOSE: ${input.purpose}` : ''

  const prompt = `Review this file for security and correctness issues.

FILE: ${input.filePath}${purposeSection}${diffSection}

CONTENT:
${input.fileContent.slice(0, 5000)}

Respond with JSON exactly matching this schema:
{
  "securityIssues": [{"severity": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", "issue": string, "fix": string}],
  "correctnessIssues": [{"type": "BUG"|"EDGE_CASE"|"TYPE_ISSUE", "issue": string, "fix": string}],
  "verdict": "APPROVE"|"REQUEST_CHANGES"|"BLOCK",
  "summary": string
}`

  try {
    const { parsed, result } = await generateParsedCriticJson<Omit<CodeReviewResult, 'providerId' | 'reviewedAt' | 'rawResponse'>>({
      system: CODE_REVIEW_SYSTEM_PROMPT,
      prompt,
      maxTokens: 1500,
      event: 'grok.critic.review.provider_failed',
      parseEvent: 'grok.critic.review.invalid_json',
    })

    log.info({
      event: 'grok.critic.review',
      file: input.filePath,
      providerId: result.provider,
      verdict: parsed.verdict,
      securityCount: parsed.securityIssues.length,
    })

    return {
      ...parsed,
      rawResponse: result.text,
      providerId: result.provider,
      reviewedAt: new Date().toISOString(),
    }
  } catch (err) {
    log.warn({ event: 'grok.critic.review.unavailable', reason: err instanceof Error ? err.message : String(err) })
    return null
  }
}

// ─── Score merger ─────────────────────────────────────────────────────────────

/**
 * Merge primary score (Claude-based) with Grok critic score.
 * Uses weighted average: 60% primary, 40% Grok (Grok is the skeptic).
 * If scores diverge by >25 points → flags as "contested" for human review.
 */
export function mergeCriticScores(
  primary: { correctnessScore: number; efficiencyScore: number; driftScore: number },
  critic: GrokCriticResult,
): {
  correctnessScore: number
  efficiencyScore: number
  driftScore: number
  contested: boolean
  contestReason?: string
} {
  const PRIMARY_WEIGHT = 0.6
  const CRITIC_WEIGHT = 0.4
  const DIVERGENCE_THRESHOLD = 25

  const correctness = Math.round(primary.correctnessScore * PRIMARY_WEIGHT + critic.correctnessScore * CRITIC_WEIGHT)
  const efficiency = Math.round(primary.efficiencyScore * PRIMARY_WEIGHT + critic.efficiencyScore * CRITIC_WEIGHT)
  const drift = Math.round(primary.driftScore * PRIMARY_WEIGHT + critic.driftScore * CRITIC_WEIGHT)

  const maxDivergence = Math.max(
    Math.abs(primary.correctnessScore - critic.correctnessScore),
    Math.abs(primary.efficiencyScore - critic.efficiencyScore),
    Math.abs(primary.driftScore - critic.driftScore),
  )

  const contested = maxDivergence > DIVERGENCE_THRESHOLD
  const contestReason = contested
    ? `Primary and Grok scores diverge by ${maxDivergence} points — human review recommended`
    : undefined

  return { correctnessScore: correctness, efficiencyScore: efficiency, driftScore: drift, contested, contestReason }
}
