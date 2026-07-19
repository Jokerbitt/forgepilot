import type { TaskContract } from '@/lib/models/delegation'
import type { PolicyDecision, PolicyViolation, PolicyVerdict } from './types'
import { evaluatePolicy } from './engine'

/**
 * Rules whose message is "human approval required" rather than an outright
 * prohibition. A genuine human sign-off (ADR-003 D2 / ADR-004) SATISFIES them,
 * so they must not keep denying in enforce mode — otherwise arming the gate
 * (the prod default) silently kills the ADR-004 Risk-C approval path: a human
 * approves on the allowlist panel and the run still gets a 403 here.
 *
 * Every other blocking rule is absolute — no approval waives secret access,
 * a destructive tool, a zero budget or an empty goal.
 */
const APPROVAL_SATISFIABLE_RULES = new Set(['risk-class-c', 'privacy-public'])

/**
 * Whether the pre-spawn policy gate is in ENFORCE mode (a 'deny' verdict blocks
 * the run) vs the default REPORT-ONLY mode (a 'deny' is logged but the run
 * proceeds). Arm it with `FORGEPILOT_POLICY_ENFORCE=1` once the report-only
 * verdicts on real runs look right (see ADR-003 D1).
 */
export function isPolicyEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.FORGEPILOT_POLICY_ENFORCE?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

export interface PolicyGateResult {
  decision: PolicyDecision
  /** True only when enforce mode is on AND the verdict denies the run. */
  blocked: boolean
  enforce: boolean
  /**
   * Blocking violations that an existing human approval satisfied. Empty unless
   * `humanApproved` was passed. Kept separate from `decision` so the audit trail
   * still shows WHAT the approval covered.
   */
  waivedByApproval: PolicyViolation[]
}

/**
 * Re-derive the decision after removing the violations a human approval already
 * satisfies. Mirrors the engine's own verdict/reason logic so a waived decision
 * is indistinguishable from one that never had those violations.
 */
function applyApprovalWaiver(
  decision: PolicyDecision,
  contract: TaskContract,
): { decision: PolicyDecision; waived: PolicyViolation[] } {
  const waived = decision.violations.filter(v => APPROVAL_SATISFIABLE_RULES.has(v.ruleId))
  if (waived.length === 0) return { decision, waived }

  const remaining = decision.violations.filter(v => !APPROVAL_SATISFIABLE_RULES.has(v.ruleId))
  const blocking = remaining.filter(v => v.severity === 'blocking')
  const warnings = remaining.filter(v => v.severity === 'warning')
  const verdict: PolicyVerdict = blocking.length > 0 ? 'deny' : warnings.length > 0 ? 'review' : 'allow'

  const parts: string[] = []
  if (blocking.length > 0) parts.push(`Blocked: ${blocking.map(v => v.message).join('; ')}`)
  if (warnings.length > 0) parts.push(`Warnings: ${warnings.map(v => v.message).join('; ')}`)
  parts.push(`Satisfied by human approval: ${waived.map(v => v.ruleId).join(', ')}`)

  return {
    decision: {
      ...decision,
      verdict,
      violations: remaining,
      reason: parts.join(' | '),
      requiresHumanApproval: verdict !== 'allow' || contract.requiresApproval,
    },
    waived,
  }
}

/**
 * Pre-spawn policy gate. Runs the Deny-first policy engine against the contract
 * before the runner dispatches, so a delegation that violates a blocking rule
 * (risk-class-c, secret-tools, destructive-actions, budget, public-privacy) can
 * be stopped BEFORE a `--dangerously`-flagged agent is spawned.
 *
 * Default is report-only: `blocked` stays false regardless of verdict, so the
 * engine can be observed on real runs with zero behavior change. Enforce mode
 * turns a 'deny' into a hard block. Pure + unit-tested — the route stays a thin
 * shell that acts on the verdict.
 *
 * `humanApproved` (from `isHumanApproval(delegation.approvedBy)`) waives the
 * approval-satisfiable rules only — see APPROVAL_SATISFIABLE_RULES. Omitting it
 * keeps the previous, stricter behavior.
 */
export function resolvePolicyGate(
  contract: TaskContract,
  opts: { enforce: boolean; humanApproved?: boolean },
): PolicyGateResult {
  const raw = evaluatePolicy(contract)
  const { decision, waived } = opts.humanApproved === true
    ? applyApprovalWaiver(raw, contract)
    : { decision: raw, waived: [] as PolicyViolation[] }
  const blocked = opts.enforce && decision.verdict === 'deny'
  return { decision, blocked, enforce: opts.enforce, waivedByApproval: waived }
}
