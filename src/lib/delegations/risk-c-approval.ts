/**
 * risk-c-approval.ts — gate logic for the Risk-C human-approval path (ADR-004).
 *
 * Risk-C is the most dangerous delegation class (auth, payments, schema). It can
 * only be lifted by a HUMAN actor who is on an explicit allowlist, and only with
 * a typed reason. This module is pure + env-driven so it is unit-testable and is
 * the single place that decides "may this actor approve a Risk-C run?".
 *
 * See ADR-004 (E1-A authorized-allowlist, E3-A mandatory reason).
 */

import { isHumanApproval } from '@/lib/delegation-execution'

/**
 * Authorized Risk-C approvers, from `FORGEPILOT_RISK_C_APPROVERS`
 * (comma-separated). Empty/unset = nobody is authorized (fail-closed): with no
 * allowlist configured, Risk-C stays un-approvable, exactly as before ADR-004.
 * Matching is case-insensitive and trims surrounding whitespace.
 */
export function getRiskCApprovers(): string[] {
  return (process.env.FORGEPILOT_RISK_C_APPROVERS ?? '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function isAuthorizedRiskCApprover(actor: string): boolean {
  const normalized = actor.trim().toLowerCase()
  if (!normalized) return false
  return getRiskCApprovers().includes(normalized)
}

export type RiskCApprovalCheck =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Validate a Risk-C approval attempt. Returns `{ ok: true }` only when the actor
 * is a human (not an automated/self-approval actor), is on the configured
 * allowlist, AND a non-empty reason is supplied. Fail-closed otherwise.
 */
export function validateRiskCApproval(actor: string, reason: string): RiskCApprovalCheck {
  const trimmedActor = actor.trim()
  const trimmedReason = reason.trim()

  // E3-A: a Risk-C approval is a conscious, recorded act — reason is mandatory.
  if (!trimmedReason) {
    return {
      ok: false,
      status: 400,
      error: 'RiskClass C: Eine Begründung (reason) ist für die Freigabe verpflichtend (ADR-004 E3).',
    }
  }

  // Reuse the central human-vs-automated check (ADR-003 D2): an automated actor
  // (autonomous-mode/autopilot/cron/…) can never approve Risk-C.
  if (!isHumanApproval({ actor: trimmedActor, approvedAt: '' })) {
    return {
      ok: false,
      status: 403,
      error: 'RiskClass C: Nur eine menschliche Freigabe ist zulässig — automatische/Selbst-Freigabe ist gesperrt (ADR-003 D2).',
    }
  }

  // E1-A: the human must be on the authorized-approver allowlist.
  if (!isAuthorizedRiskCApprover(trimmedActor)) {
    return {
      ok: false,
      status: 403,
      error: 'RiskClass C: Dieser Akteur ist nicht für Risk-C-Freigaben autorisiert (FORGEPILOT_RISK_C_APPROVERS, ADR-004 E1).',
    }
  }

  return { ok: true }
}
