'use client'

import type { Delegation } from '@/lib/models/delegation'
import { getSlaStatus, formatSlaRemaining, computeDueAt, SLA_HOURS_BY_RISK } from '@/lib/delegations/sla'

interface SlaBadgeProps {
  delegation: Delegation
  /** Show compact (dot only) or full badge with text */
  compact?: boolean
}

const STATUS_STYLES = {
  ok:      'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  breached: 'bg-red-500/10 border-red-500/20 text-red-400',
  na:      '',
}

const STATUS_DOT = {
  ok:      'bg-emerald-400',
  warning: 'bg-amber-400 animate-pulse',
  breached: 'bg-red-400 animate-pulse',
  na:      '',
}

export function SlaBadge({ delegation, compact = false }: SlaBadgeProps) {
  const status = getSlaStatus(delegation)
  if (status === 'na') return null

  const remaining = formatSlaRemaining(delegation)
  const dueAt = computeDueAt(delegation)
  const riskClass = delegation.contract?.riskClass
  const slaHours = riskClass ? SLA_HOURS_BY_RISK[riskClass] : null

  const title = dueAt
    ? `SLA: ${slaHours}h · Fällig ${dueAt.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`
    : ''

  if (compact) {
    return (
      <span
        title={`${remaining}${title ? ` · ${title}` : ''}`}
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[status]}`}
      />
    )
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 ${STATUS_STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      <span>
        {status === 'breached' ? '⚠ ' : ''}
        {remaining}
      </span>
    </span>
  )
}
