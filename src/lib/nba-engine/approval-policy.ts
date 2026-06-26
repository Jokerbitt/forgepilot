import type { RiskClass } from '@/lib/models/work-item'

export type ApprovalMode = 'manual' | 'balanced' | 'autopilot'

interface ApprovalPolicyInput {
  approvalMode: ApprovalMode
  riskClass: RiskClass
  scoreTotal?: number
  autopilotMinScore: number
  autopilotMaxRiskClass: RiskClass
}

const RISK_WEIGHT: Record<RiskClass, number> = {
  A: 1,
  B: 2,
  C: 3,
}

export function shouldRequireApproval(input: ApprovalPolicyInput): boolean {
  // ADR-003 D2: Risk-C ALWAYS requires human approval — never auto-approved,
  // regardless of mode, NBA score, or the configured autopilot max risk class.
  // Keeps Risk-C from ever reaching requiresApproval=false in the autopilot/intake
  // paths; the execution choke-point (getExecutionStartBlocker) enforces the same.
  if (input.riskClass === 'C') {
    return true
  }

  if (input.approvalMode === 'manual') {
    return true
  }

  if (input.approvalMode === 'balanced') {
    return input.riskClass !== 'A'
  }

  const score = input.scoreTotal ?? 0
  const riskAllowed = RISK_WEIGHT[input.riskClass] <= RISK_WEIGHT[input.autopilotMaxRiskClass]

  return !(riskAllowed && score >= input.autopilotMinScore)
}

export function describeApprovalMode(mode: ApprovalMode): string {
  if (mode === 'manual') {
    return 'Jede Delegation braucht eine manuelle Freigabe.'
  }

  if (mode === 'balanced') {
    return 'Class-A-Aufgaben laufen ohne Extra-Klick, Class B/C bleiben freigabepflichtig.'
  }

  return 'Aufgaben bis zur erlaubten RiskClass laufen ab Mindestscore automatisch.'
}
