import type { TaskContract } from '@/lib/models/delegation'
import type { PolicyDecision } from './types'
import { evaluatePolicy } from './engine'

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
 */
export function resolvePolicyGate(
  contract: TaskContract,
  opts: { enforce: boolean },
): PolicyGateResult {
  const decision = evaluatePolicy(contract)
  const blocked = opts.enforce && decision.verdict === 'deny'
  return { decision, blocked, enforce: opts.enforce }
}
