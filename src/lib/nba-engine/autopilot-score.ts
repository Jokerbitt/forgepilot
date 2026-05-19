import type { TaskContract } from '@/lib/models/delegation'

export interface AutopilotScoreResult {
  score: number          // 0–100
  level: 'green' | 'amber' | 'red'
  label: string
  reasons: string[]      // human-readable deductions
  canAutopilot: boolean  // score >= 70 && no hard blocks
}

interface ScoreDeduction {
  points: number
  reason: string
}

/** Compute an autopilot readiness score for a TaskContract. Pure function. */
export function computeAutopilotScore(contract: TaskContract): AutopilotScoreResult {
  const deductions: ScoreDeduction[] = []

  // ── Hard blocks (large deductions) ─────────────────────────────────────
  if (contract.riskClass === 'C') {
    deductions.push({ points: 60, reason: 'Risk Class C — manuelle Freigabe zwingend' })
  } else if (contract.riskClass === 'B') {
    deductions.push({ points: 25, reason: 'Risk Class B — Review empfohlen' })
  }

  if (contract.requiresApproval) {
    deductions.push({ points: 20, reason: 'Manuelle Freigabe eingestellt' })
  }

  if (contract.privacyMode === 'public') {
    deductions.push({ points: 25, reason: 'Privacy-Modus öffentlich — erhöhtes Datenschutz-Risiko' })
  } else if (contract.privacyMode === 'private-cloud') {
    deductions.push({ points: 10, reason: 'Private Cloud — Daten verlassen lokale Umgebung' })
  }

  // ── Soft deductions (contract quality) ─────────────────────────────────
  if (!contract.definitionOfDone || contract.definitionOfDone.length === 0) {
    deductions.push({ points: 10, reason: 'Keine Definition of Done angegeben' })
  }

  if (!contract.goal || contract.goal.trim().length < 10) {
    deductions.push({ points: 10, reason: 'Ziel zu kurz oder nicht definiert' })
  }

  if (!contract.context || contract.context.trim().length < 5) {
    deductions.push({ points: 5, reason: 'Kein Kontext angegeben' })
  }

  if (!contract.allowedTools || contract.allowedTools.length === 0) {
    deductions.push({ points: 5, reason: 'Keine erlaubten Tools definiert' })
  }

  if (contract.maxBudgetUsd > 50) {
    deductions.push({ points: 10, reason: `Budget sehr hoch ($${contract.maxBudgetUsd})` })
  } else if (contract.maxBudgetUsd > 20) {
    deductions.push({ points: 5, reason: `Budget erhöht ($${contract.maxBudgetUsd})` })
  }

  // ── Compute final score ─────────────────────────────────────────────────
  const totalDeductions = deductions.reduce((sum, d) => sum + d.points, 0)
  const score = Math.max(0, Math.min(100, 100 - totalDeductions))

  const hasHardBlock = contract.riskClass === 'C'
  const canAutopilot = score >= 70 && !hasHardBlock

  let level: AutopilotScoreResult['level']
  let label: string
  if (score >= 80) {
    level = 'green'
    label = 'Autopilot bereit'
  } else if (score >= 50) {
    level = 'amber'
    label = 'Review empfohlen'
  } else {
    level = 'red'
    label = 'Manuell erforderlich'
  }

  return {
    score,
    level,
    label,
    reasons: deductions.map(d => d.reason),
    canAutopilot,
  }
}
