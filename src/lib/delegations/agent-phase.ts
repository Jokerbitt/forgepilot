/**
 * Agent phase inference from delegation logs.
 *
 * Parses agent log messages to determine the current execution phase and
 * whether the operator's attention is needed (ESCALATION, error, stall).
 */
import type { AgentLog, Delegation } from '@/lib/models/delegation'

export type AgentPhase =
  | 'starting'
  | 'exploring'
  | 'implementing'
  | 'testing'
  | 'committing'
  | 'pr_created'
  | 'smoke_testing'
  | 'done'
  | 'escalation'
  | 'failed'

export interface PhaseInfo {
  phase: AgentPhase
  label: string
  emoji: string
  /** Operator attention required — true when escalation or repeated errors */
  needsAttention: boolean
  attentionReason?: string
  /** Most recent PROGRESS signal: "X done | Y next | Z/N turns" */
  progressSignal?: string
  /** PR URL extracted from logs */
  prUrl?: string
  /** Turn count extracted from most recent PROGRESS signal */
  turnsUsed?: number
  maxTurns?: number
}

const PHASE_LABELS: Record<AgentPhase, { label: string; emoji: string }> = {
  starting:      { label: 'Startet',       emoji: '🚀' },
  exploring:     { label: 'Erkundet',      emoji: '🔍' },
  implementing:  { label: 'Implementiert', emoji: '✏️' },
  testing:       { label: 'Testet',        emoji: '🧪' },
  committing:    { label: 'Committed',     emoji: '📝' },
  pr_created:    { label: 'PR erstellt',   emoji: '🔀' },
  smoke_testing: { label: 'Smoke-Test',    emoji: '🔬' },
  done:          { label: 'Fertig',        emoji: '✅' },
  escalation:    { label: 'ESKALATION',    emoji: '🚨' },
  failed:        { label: 'Fehlgeschlagen', emoji: '❌' },
}

/** Extract PR URL from a log message, if any. */
function extractPrUrl(message: string): string | undefined {
  const match = message.match(/https?:\/\/github\.com\/[^\s"']+\/pull\/\d+/)
  return match?.[0]
}

/** Parse turn counts from PROGRESS signal: "X done | Y next | Z/N turns" */
function parseTurns(message: string): { used: number; max: number } | undefined {
  const match = message.match(/(\d+)\/(\d+)\s+turns/)
  if (!match) return undefined
  return { used: parseInt(match[1], 10), max: parseInt(match[2], 10) }
}

/**
 * Infers the current agent phase from log history.
 * Scans all logs to build a picture — last signal wins for phase, but
 * ESCALATION and errors are sticky if no DONE/success follows.
 */
export function inferAgentPhase(delegation: Delegation): PhaseInfo {
  const logs = delegation.logs ?? []
  const status = delegation.status

  if (status === 'failed') {
    return {
      phase: 'failed',
      ...PHASE_LABELS.failed,
      needsAttention: true,
      attentionReason: delegation.errorMessage ?? 'Delegation fehlgeschlagen',
    }
  }

  if (status === 'completed') {
    const prUrl = logs.reduceRight<string | undefined>((found, l) => found ?? extractPrUrl(l.message), undefined)
    return {
      phase: 'done',
      ...PHASE_LABELS.done,
      needsAttention: false,
      prUrl,
    }
  }

  // Not yet running — pending or approved
  if (status !== 'running') {
    return { phase: 'starting', ...PHASE_LABELS.starting, needsAttention: false }
  }

  // Scan logs in order to determine current phase
  let phase: AgentPhase = 'exploring'
  let needsAttention = false
  let attentionReason: string | undefined
  let progressSignal: string | undefined
  let prUrl: string | undefined
  let turnsUsed: number | undefined
  let maxTurns: number | undefined

  let consecutiveErrors = 0

  for (const log of logs) {
    const msg = log.message

    // PR detection
    const foundPr = extractPrUrl(msg)
    if (foundPr) {
      prUrl = foundPr
      phase = 'pr_created'
    }

    // Phase signals from log content
    if (/\bDONE:/i.test(msg) || log.type === 'success') {
      phase = 'done'
      needsAttention = false
      attentionReason = undefined
    } else if (/ESCALATION:/i.test(msg)) {
      phase = 'escalation'
      needsAttention = true
      attentionReason = msg.replace(/^ESCALATION:\s*/i, '').slice(0, 120)
    } else if (/smoke.?test/i.test(msg)) {
      if (phase !== 'pr_created' && phase !== 'done') phase = 'smoke_testing'
    } else if (/gh\s+pr\s+create|pull_request|open.*PR/i.test(msg)) {
      phase = 'pr_created'
    } else if (/git\s+commit|git commit/i.test(msg) && phase !== 'pr_created') {
      phase = 'committing'
    } else if (/npm.*test|vitest|run.*test|type.?check|lint/i.test(msg) && phase !== 'pr_created' && phase !== 'committing') {
      phase = 'testing'
    } else if ((log.type === 'command' || /\bnpm\s+run\b|\bnode\b|\bts-node\b|\bwrite_file\b|\bedit_file\b/i.test(msg)) && phase === 'exploring') {
      phase = 'implementing'
    } else if (/\bread_file\b|\bls\b|\bfind\b|\bgrep\b|\bcat\b|\breaddir\b|explore|understand/i.test(msg) && phase === 'exploring') {
      phase = 'exploring'
    }

    // PROGRESS signal
    if (/^PROGRESS:/i.test(msg)) {
      progressSignal = msg.replace(/^PROGRESS:\s*/i, '')
      const turns = parseTurns(msg)
      if (turns) {
        turnsUsed = turns.used
        maxTurns = turns.max
      }
    }

    // Error tracking
    if (log.type === 'error') {
      consecutiveErrors++
      if (consecutiveErrors >= 3 && !needsAttention) {
        needsAttention = true
        attentionReason = `Wiederholende Fehler: ${msg.slice(0, 80)}`
      }
    } else {
      consecutiveErrors = 0
    }
  }

  return {
    phase,
    ...PHASE_LABELS[phase],
    needsAttention,
    attentionReason,
    progressSignal,
    prUrl,
    turnsUsed,
    maxTurns,
  }
}
