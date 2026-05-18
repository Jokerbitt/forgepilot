import type { TaskContract } from '@/lib/models/delegation'
import type { PolicyDecision, PolicyRule, PolicyViolation } from './types'
import { DEFAULT_RULES } from './rules'

export function evaluatePolicy(
  contract: TaskContract,
  rules: PolicyRule[] = DEFAULT_RULES,
): PolicyDecision {
  const violations: PolicyViolation[] = rules.flatMap(rule => rule.evaluate(contract))

  const blocking = violations.filter(v => v.severity === 'blocking')
  const warnings = violations.filter(v => v.severity === 'warning')

  let verdict: PolicyDecision['verdict']
  if (blocking.length > 0) {
    verdict = 'deny'
  } else if (warnings.length > 0) {
    verdict = 'review'
  } else {
    verdict = 'allow'
  }

  const requiresHumanApproval =
    verdict === 'deny' ||
    verdict === 'review' ||
    contract.requiresApproval

  const reason = buildReason(verdict, blocking, warnings)

  return {
    verdict,
    violations,
    reason,
    requiresHumanApproval,
    evaluatedAt: new Date().toISOString(),
  }
}

function buildReason(
  verdict: PolicyDecision['verdict'],
  blocking: PolicyViolation[],
  warnings: PolicyViolation[],
): string {
  if (verdict === 'allow' && blocking.length === 0 && warnings.length === 0) {
    return 'All policy rules passed.'
  }
  const parts: string[] = []
  if (blocking.length > 0) {
    parts.push(`Blocked: ${blocking.map(v => v.message).join('; ')}`)
  }
  if (warnings.length > 0) {
    parts.push(`Warnings: ${warnings.map(v => v.message).join('; ')}`)
  }
  return parts.join(' | ')
}
