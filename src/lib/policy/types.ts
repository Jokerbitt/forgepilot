import type { TaskContract } from '@/lib/models/delegation'

export type PolicyVerdict = 'allow' | 'deny' | 'review'

export interface PolicyViolation {
  ruleId: string
  message: string
  severity: 'blocking' | 'warning'
}

export interface PolicyDecision {
  verdict: PolicyVerdict
  violations: PolicyViolation[]
  reason: string
  requiresHumanApproval: boolean
  evaluatedAt: string
}

export interface PolicyRule {
  id: string
  description: string
  evaluate(contract: TaskContract): PolicyViolation[]
}
