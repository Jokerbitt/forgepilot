/**
 * Structured Logger — M95
 *
 * Built on Pino — the fastest Node.js logger, non-blocking async output.
 *
 * Dev:  pretty-printed with colors (pino-pretty)
 * Prod: newline-delimited JSON (Vercel Logs / Docker / Datadog-compatible)
 *
 * Usage:
 *   import { logger, aiLogger, evalLogger, dsgvoLogger } from '@/lib/logger'
 *
 *   logger.info({ event: 'delegation.create', id }, 'Delegation created')
 *   aiLogger.warn({ event: 'ai.key_missing', provider }, 'No API key')
 *   dsgvoLogger.error({ event: 'erasure.failed', externalId }, err.message)
 */

import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'
const level  = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info')

export const logger = pino({
  level,
  // In development: pretty-print with colors + readable timestamps
  // In production: raw JSON newlines (fastest, log-aggregator compatible)
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize:        true,
        translateTime:   'HH:MM:ss',
        ignore:          'pid,hostname',
        messageFormat:   '[{module}] {msg}',
      },
    },
  }),
  // Base fields on every log line
  base: {
    app:     'forgepilot',
    version: process.env.npm_package_version ?? '0.1.0',
  },
  // Redact sensitive fields — never log keys or tokens
  redact: {
    paths:  ['apiKey', '*.apiKey', 'token', '*.token', 'password', '*.password'],
    censor: '[REDACTED]',
  },
})

// ─── Module-specific child loggers ───────────────────────────────────────────
// Each child inherits parent config + adds a `module` field for filtering.

/** Logger for AI provider calls and text generation */
export const aiLogger = logger.child({ module: 'ai' })

/** Logger for eval harness scoring and regression detection */
export const evalLogger = logger.child({ module: 'eval' })

/** Logger for DSGVO/GDPR compliance events */
export const dsgvoLogger = logger.child({ module: 'dsgvo' })

/** Logger for delegation lifecycle events */
export const delegationLogger = logger.child({ module: 'delegation' })

/** Logger for orchestration runs */
export const orchestrationLogger = logger.child({ module: 'orchestration' })

/** Logger for API routes and HTTP layer */
export const apiLogger = logger.child({ module: 'api' })

// ─── Typed log event helpers ─────────────────────────────────────────────────

/** Log an AI provider call result */
export function logAICall(opts: {
  event: 'ai.generate' | 'ai.embed' | 'ai.key_missing' | 'ai.error'
  provider: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  durationMs?: number
  error?: string
}): void {
  if (opts.event === 'ai.error') {
    aiLogger.error(opts, opts.error ?? 'AI call failed')
  } else if (opts.event === 'ai.key_missing') {
    aiLogger.warn(opts, 'API key not configured')
  } else {
    aiLogger.info(opts, `AI ${opts.event.split('.')[1]}`)
  }
}

/** Log a DSGVO compliance event */
export function logDSGVO(opts: {
  event: 'pii.detected' | 'pii.redacted' | 'ledger.write' | 'erasure.request' | 'erasure.execute' | 'retention.cleanup'
  count?: number
  categories?: string[]
  externalId?: string
  deletedCount?: number
}): void {
  dsgvoLogger.info(opts, `DSGVO ${opts.event}`)
}

/** Log an eval result */
export function logEvalResult(opts: {
  event: 'eval.scored' | 'eval.regression'
  caseId: string
  grade: string
  previousGrade?: string
  correctnessScore: number
  efficiencyScore: number
  driftScore: number
}): void {
  if (opts.event === 'eval.regression') {
    evalLogger.warn(opts, `Regression: ${opts.previousGrade} → ${opts.grade}`)
  } else {
    evalLogger.info(opts, `Eval scored: ${opts.grade}`)
  }
}
