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
import { getAllProviderConfigs, getModelSelection } from '@/lib/ai/providers/config-store'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'grok-critic' })

const DEFAULT_LOCAL_CRITIC_MODEL = 'qwen2.5-coder:14b'
const CRITIC_MODE_ENV = 'FORGEPILOT_CRITIC_MODE'
const CRITIC_PROVIDERS_ENV = 'FORGEPILOT_CRITIC_PROVIDERS'
const LEGACY_CRITIC_PROVIDER_ENV = 'FORGEPILOT_CRITIC_PROVIDER'
const LEGACY_CRITIC_MODEL_ENV = 'FORGEPILOT_CRITIC_MODEL'

interface CriticProviderCandidate {
  providerId: string
  model?: string
  configured?: boolean
  reason?: string
}

function parseCriticProviderList(value: string | undefined): CriticProviderCandidate[] {
  if (!value) return []

  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const equalsIdx = entry.indexOf('=')
      if (equalsIdx > 0) {
        return {
          providerId: entry.slice(0, equalsIdx).trim(),
          model: entry.slice(equalsIdx + 1).trim() || undefined,
        }
      }

      const colonIdx = entry.indexOf(':')
      if (colonIdx > 0) {
        return {
          providerId: entry.slice(0, colonIdx).trim(),
          model: entry.slice(colonIdx + 1).trim() || undefined,
        }
      }

      return { providerId: entry }
    })
    .filter(candidate => Boolean(candidate.providerId))
}

function addCandidate(candidates: CriticProviderCandidate[], candidate: CriticProviderCandidate): void {
  if (!candidate.providerId) return
  candidates.push({ ...candidate, providerId: normalizeCriticProviderId(candidate.providerId) })
}

function normalizeCriticProviderId(providerId: string): string {
  const normalized = providerId.trim().toLowerCase()
  if (normalized === 'gemini') return 'google-gemini'
  if (normalized === 'lmstudio') return 'lm-studio'
  if (normalized === 'grok') return 'xai'
  return providerId.trim()
}

function resolveApiKey(apiKeyRef: string | undefined): string {
  if (!apiKeyRef) return ''
  const stored = readStoredApiKeys() as Record<string, string | undefined>
  return process.env[apiKeyRef] ?? stored[apiKeyRef] ?? ''
}

function annotateCriticCandidate(candidate: CriticProviderCandidate): CriticProviderCandidate {
  const config = getAllProviderConfigs().find(provider => provider.id === candidate.providerId)
  if (!config) {
    return { ...candidate, configured: true, reason: 'custom provider or legacy provider id' }
  }

  if (config.dataResidency === 'local' || !config.apiKeyRef) {
    return { ...candidate, configured: true, reason: 'local provider, checked at runtime' }
  }

  const configured = resolveApiKey(config.apiKeyRef).trim().length > 0
  return {
    ...candidate,
    configured,
    reason: configured ? 'api key configured' : `${config.apiKeyRef} missing`,
  }
}

function getCriticProviderCandidates(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): CriticProviderCandidate[] {
  const mode = String(env[CRITIC_MODE_ENV] ?? 'auto').trim().toLowerCase()
  const configuredModel = env[LEGACY_CRITIC_MODEL_ENV]?.trim()
  const candidates: CriticProviderCandidate[] = []
  const explicitCandidates = parseCriticProviderList(env[CRITIC_PROVIDERS_ENV])

  for (const candidate of explicitCandidates) addCandidate(candidates, candidate)

  const configuredProvider = env[LEGACY_CRITIC_PROVIDER_ENV]?.trim()
  if (configuredProvider && !explicitCandidates.length) {
    addCandidate(candidates, { providerId: configuredProvider, model: configuredModel || undefined })
  }

  if (mode === 'single') {
    return dedupeCriticCandidates(candidates.length > 0 ? candidates : [{ providerId: 'xai', model: configuredModel || undefined }])
  }

  try {
    const selection = getModelSelection()
    addCandidate(candidates, { providerId: selection.codingProvider, model: selection.codingModel })
    if (selection.codingFallbackProvider) {
      addCandidate(candidates, {
        providerId: selection.codingFallbackProvider,
        model: selection.codingFallbackModel,
      })
    }
    addCandidate(candidates, { providerId: selection.fastProvider, model: selection.fastModel })
    if (selection.fastFallbackProvider) {
      addCandidate(candidates, {
        providerId: selection.fastFallbackProvider,
        model: selection.fastFallbackModel,
      })
    }
  } catch (err) {
    log.warn({ event: 'critic.model_selection_unavailable', reason: err instanceof Error ? err.message : String(err) })
  }

  for (const candidate of [
    { providerId: 'xai', model: 'grok-3-mini' },
    { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
    { providerId: 'openai', model: 'o3-mini' },
    { providerId: 'google-gemini', model: 'gemini-1.5-pro' },
    { providerId: 'deepseek', model: 'deepseek-reasoner' },
    { providerId: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },
    { providerId: 'groq', model: 'llama-3.3-70b-versatile' },
    { providerId: 'mistral', model: 'mistral-large-latest' },
    { providerId: 'ollama', model: DEFAULT_LOCAL_CRITIC_MODEL },
    { providerId: 'lm-studio', model: 'local-model' },
  ]) {
    addCandidate(candidates, candidate)
  }

  return dedupeCriticCandidates(candidates)
}

function dedupeCriticCandidates(candidates: CriticProviderCandidate[]): CriticProviderCandidate[] {
  const seen = new Set<string>()
  return candidates.filter(candidate => {
    const providerId = normalizeCriticProviderId(candidate.providerId)
    const model = candidate.model?.trim()
    const key = `${providerId}:${model ?? ''}`
    if (!providerId || seen.has(key)) return false
    seen.add(key)
    Object.assign(candidate, annotateCriticCandidate({
      ...candidate,
      providerId,
      model: model || undefined,
    }))
    return true
  })
}

function getRunnableCriticCandidates(): CriticProviderCandidate[] {
  const source = process.env as Record<string, string | undefined>
  const plan = getCriticProviderPlan(source)
  if (plan.mode === 'single' || source[CRITIC_PROVIDERS_ENV] || source[LEGACY_CRITIC_PROVIDER_ENV]) {
    return plan.candidates
  }
  return plan.candidates.filter(candidate => candidate.configured !== false)
}

function describeCriticConfig(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): string {
  const mode = String(env[CRITIC_MODE_ENV] ?? 'auto').trim().toLowerCase()
  const providers = getCriticProviderCandidates(env)
    .map(candidate => candidate.model ? `${candidate.providerId}:${candidate.model}` : candidate.providerId)
    .join(', ')

  return `${mode || 'auto'} (${providers})`
}

export function getCriticProviderPlan(env?: Record<string, string | undefined>): {
  mode: string
  candidates: CriticProviderCandidate[]
  description: string
} {
  const source = env ?? process.env as Record<string, string | undefined>
  const mode = String(source[CRITIC_MODE_ENV] ?? 'auto').trim().toLowerCase() || 'auto'
  const candidates = getCriticProviderCandidates(source)
  return {
    mode,
    candidates,
    description: describeCriticConfig(source),
  }
}

function buildCriticUnavailableMessage(): string {
  return (
    'No critic provider returned valid JSON. Configure ' +
    `${CRITIC_PROVIDERS_ENV}="xai:grok-3-mini,anthropic:claude-sonnet-4-5,google-gemini:gemini-1.5-pro,ollama:qwen2.5-coder:14b" ` +
    `or leave ${CRITIC_MODE_ENV}=auto to try configured cloud providers and local Ollama/LM Studio.`
  )
}

async function generateCriticJson(options: {
  system: string
  prompt: string
  maxTokens: number
  event: string
}) {
  let lastError: unknown

  for (const candidate of getRunnableCriticCandidates()) {
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

  throw lastError instanceof Error ? lastError : new Error(buildCriticUnavailableMessage())
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

  throw lastError instanceof Error ? lastError : new Error(buildCriticUnavailableMessage())
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
