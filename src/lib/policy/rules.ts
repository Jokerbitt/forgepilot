import type { TaskContract } from '@/lib/models/delegation'
import type { PolicyRule, PolicyViolation } from './types'

const SECRET_TOOL_PATTERNS = [
  /secret/i,
  /credential/i,
  /password/i,
  /private.?key/i,
  /\.env/i,
  /ssh.?key/i,
  /api.?key/i,
]

const DESTRUCTIVE_TOOL_PATTERNS = [
  /rm\s+-rf/i,
  /drop\s+table/i,
  /delete\s+all/i,
  /truncate/i,
  /format\s+disk/i,
  /git\s+push\s+--force/i,
]

function violation(ruleId: string, message: string, severity: PolicyViolation['severity']): PolicyViolation {
  return { ruleId, message, severity }
}

export const riskClassCRule: PolicyRule = {
  id: 'risk-class-c',
  description: 'Risk Class C always requires human approval.',
  evaluate(contract) {
    if (contract.riskClass === 'C') {
      return [violation('risk-class-c', 'Risk Class C: human approval required.', 'blocking')]
    }
    return []
  },
}

export const secretToolRule: PolicyRule = {
  id: 'secret-tools',
  description: 'Deny any task that grants access to secrets or credentials.',
  evaluate(contract) {
    // allowedTools is typed string[] but is not enforced by the create schema
    // (DelegationInputSchema passes the contract through), so a delegation
    // persisted without it would crash this rule. Default to an empty list.
    const hits = (contract.allowedTools ?? []).filter(tool =>
      SECRET_TOOL_PATTERNS.some(p => p.test(tool)),
    )
    if (hits.length > 0) {
      return [violation('secret-tools', `Secret access denied: ${hits.join(', ')}`, 'blocking')]
    }
    return []
  },
}

export const destructiveActionRule: PolicyRule = {
  id: 'destructive-actions',
  description: 'Deny destructive operations (rm -rf, DROP TABLE, force push).',
  evaluate(contract) {
    const hits = (contract.allowedTools ?? []).filter(tool =>
      DESTRUCTIVE_TOOL_PATTERNS.some(p => p.test(tool)),
    )
    if (hits.length > 0) {
      return [violation('destructive-actions', `Destructive tool detected: ${hits.join(', ')}`, 'blocking')]
    }
    return []
  },
}

export const budgetRule: PolicyRule = {
  id: 'budget',
  description: 'Deny tasks where estimated cost exceeds maxBudgetUsd.',
  evaluate(contract) {
    if (contract.maxBudgetUsd <= 0) {
      return [violation('budget', 'maxBudgetUsd must be greater than zero.', 'blocking')]
    }
    return []
  },
}

export const goalRequiredRule: PolicyRule = {
  id: 'goal-required',
  description: 'Task must have a non-empty goal.',
  evaluate(contract) {
    if (!contract.goal?.trim()) {
      return [violation('goal-required', 'Task goal is empty.', 'blocking')]
    }
    return []
  },
}

export const definitionOfDoneRule: PolicyRule = {
  id: 'dod-required',
  description: 'Task should have at least one Definition of Done item.',
  evaluate(contract) {
    if (!contract.definitionOfDone?.length) {
      return [violation('dod-required', 'No Definition of Done defined — review recommended.', 'warning')]
    }
    return []
  },
}

export const publicPrivacyRule: PolicyRule = {
  id: 'privacy-public',
  description: 'Public privacy mode always requires explicit approval.',
  evaluate(contract) {
    if (contract.privacyMode === 'public') {
      return [violation('privacy-public', 'Privacy mode is public: human approval required.', 'blocking')]
    }
    return []
  },
}

export const DEFAULT_RULES: PolicyRule[] = [
  riskClassCRule,
  secretToolRule,
  destructiveActionRule,
  budgetRule,
  goalRequiredRule,
  definitionOfDoneRule,
  publicPrivacyRule,
]
