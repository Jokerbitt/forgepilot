import type { AgentLog } from '@/lib/models/delegation'

export type DriftSignalType =
  | 'no_progress_signal'    // agent hasn't reported PROGRESS in expected interval
  | 'no_commit_mid_run'     // >60% of turns used, no commit yet
  | 'escalation_detected'   // agent printed ESCALATION
  | 'repeated_error'        // same error pattern 3+ times
  | 'scope_warning'         // agent mentioned touching unexpected files
  | 'stalled'               // no log activity for >5 minutes

export interface DriftSignal {
  type: DriftSignalType
  severity: 'critical' | 'warning' | 'info'
  message: string
  detectedAt: string
  turnEstimate?: number
}

export interface DriftAnalysis {
  hasDrift: boolean
  driftScore: number          // 0–100, higher = more drift
  signals: DriftSignal[]
  lastProgressAt?: string
  lastCommitAt?: string
  estimatedTurns: number
  recommendation: string
}

function countTurns(logs: AgentLog[]): number {
  return logs.filter(l => l.type === 'command' || l.type === 'info').length
}

function findLastProgress(logs: AgentLog[]): AgentLog | undefined {
  return [...logs].reverse().find(l =>
    l.message.includes('PROGRESS:') || l.message.includes('CHECKPOINT:')
  )
}

function findLastCommit(logs: AgentLog[]): AgentLog | undefined {
  return [...logs].reverse().find(l =>
    l.message.toLowerCase().includes('git commit') ||
    l.message.toLowerCase().includes('committed') ||
    /^(feat|fix|chore|refactor|test|docs|style)[(:)]/.test(l.message)
  )
}

function detectEscalations(logs: AgentLog[]): AgentLog[] {
  return logs.filter(l => l.message.includes('ESCALATION:'))
}

function detectRepeatedErrors(logs: AgentLog[]): string[] {
  const errorMessages = logs
    .filter(l => l.type === 'error')
    .map(l => l.message.substring(0, 80))

  const counts: Record<string, number> = {}
  for (const msg of errorMessages) {
    const key = msg.toLowerCase().replace(/[^a-z0-9 ]/g, '')
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 3)
    .map(([msg]) => msg)
}

function detectStall(logs: AgentLog[]): boolean {
  if (logs.length === 0) return false
  const lastLog = logs[logs.length - 1]
  const lastTime = new Date(lastLog.timestamp).getTime()
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000
  return now - lastTime > fiveMinutes
}

export function analyzeDrift(logs: AgentLog[], maxTurns: number): DriftAnalysis {
  const signals: DriftSignal[] = []
  const estimatedTurns = countTurns(logs)
  const turnRatio = maxTurns > 0 ? estimatedTurns / maxTurns : 0
  const now = new Date().toISOString()

  // Signal: no PROGRESS report when halfway through
  const lastProgress = findLastProgress(logs)
  if (estimatedTurns > 10 && !lastProgress) {
    signals.push({
      type: 'no_progress_signal',
      severity: 'warning',
      message: `${estimatedTurns} Turns ohne PROGRESS-Signal — Agent meldet keinen Fortschritt`,
      detectedAt: now,
      turnEstimate: estimatedTurns,
    })
  }

  // Signal: >60% turns used, no commit
  const lastCommit = findLastCommit(logs)
  if (turnRatio > 0.6 && !lastCommit) {
    signals.push({
      type: 'no_commit_mid_run',
      severity: 'critical',
      message: `${Math.round(turnRatio * 100)}% des Budgets verbraucht ohne Commit — möglicher Drift`,
      detectedAt: now,
      turnEstimate: estimatedTurns,
    })
  }

  // Signal: ESCALATION detected
  const escalations = detectEscalations(logs)
  for (const esc of escalations) {
    signals.push({
      type: 'escalation_detected',
      severity: 'critical',
      message: esc.message.substring(0, 200),
      detectedAt: esc.timestamp,
      turnEstimate: estimatedTurns,
    })
  }

  // Signal: repeated errors
  const repeatedErrors = detectRepeatedErrors(logs)
  for (const errMsg of repeatedErrors) {
    signals.push({
      type: 'repeated_error',
      severity: 'warning',
      message: `Wiederholter Fehler (3+ Mal): "${errMsg}"`,
      detectedAt: now,
      turnEstimate: estimatedTurns,
    })
  }

  // Signal: stall
  if (logs.length > 0 && detectStall(logs)) {
    signals.push({
      type: 'stalled',
      severity: 'warning',
      message: 'Kein Log-Eintrag seit >5 Minuten — Agent möglicherweise blockiert',
      detectedAt: now,
      turnEstimate: estimatedTurns,
    })
  }

  // Drift score: weighted sum of signals
  const scoreMap: Record<string, number> = {
    critical: 35,
    warning: 15,
    info: 5,
  }
  const rawScore = signals.reduce((sum, s) => sum + (scoreMap[s.severity] ?? 0), 0)
  const driftScore = Math.min(100, rawScore)

  const hasDrift = driftScore >= 15

  let recommendation: string
  if (driftScore >= 50) {
    recommendation = 'Agent stoppen und Task neu delegieren — hohes Drift-Risiko'
  } else if (driftScore >= 25) {
    recommendation = 'Logs manuell prüfen — Drift-Signale vorhanden'
  } else if (driftScore >= 10) {
    recommendation = 'Leichte Drift-Signale — weiter beobachten'
  } else {
    recommendation = 'Agent arbeitet fokussiert'
  }

  return {
    hasDrift,
    driftScore,
    signals,
    lastProgressAt: lastProgress?.timestamp,
    lastCommitAt: lastCommit?.timestamp,
    estimatedTurns,
    recommendation,
  }
}
