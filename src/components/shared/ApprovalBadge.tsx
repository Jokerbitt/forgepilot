import type { RiskClass } from '@/lib/models/work-item'

export type ApprovalBadgeState = 'auto-approved' | 'approval-required' | 'risk-blocked'

interface ApprovalBadgeProps {
  requiresApproval: boolean
  riskClass: RiskClass
  compact?: boolean
  className?: string
}

export function getApprovalBadgeState(requiresApproval: boolean, riskClass: RiskClass): ApprovalBadgeState {
  if (riskClass === 'C' && requiresApproval) {
    return 'risk-blocked'
  }

  return requiresApproval ? 'approval-required' : 'auto-approved'
}

export function ApprovalBadge({ requiresApproval, riskClass, compact = false, className = '' }: ApprovalBadgeProps) {
  const state = getApprovalBadgeState(requiresApproval, riskClass)

  const styles: Record<ApprovalBadgeState, string> = {
    'auto-approved': 'border-green-800/70 bg-green-950/50 text-green-300',
    'approval-required': 'border-yellow-800/70 bg-yellow-950/50 text-yellow-300',
    'risk-blocked': 'border-red-800/70 bg-red-950/50 text-red-300',
  }

  const labels: Record<ApprovalBadgeState, string> = {
    'auto-approved': compact ? 'Auto' : 'Auto-freigegeben',
    'approval-required': compact ? 'Freigabe' : 'Freigabe noetig',
    'risk-blocked': compact ? 'Risk-C' : 'Risk-C: Freigabe noetig',
  }

  const title: Record<ApprovalBadgeState, string> = {
    'auto-approved': 'Diese Delegation darf ohne zusaetzlichen Klick weiterlaufen.',
    'approval-required': 'Diese Delegation wartet auf eine bewusste Freigabe.',
    'risk-blocked': 'RiskClass C startet nie automatisch — braucht eine bewusste menschliche Freigabe in der Detailansicht (ADR-004).',
  }

  return (
    <span
      title={title[state]}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${styles[state]} ${className}`}
    >
      {labels[state]}
    </span>
  )
}
