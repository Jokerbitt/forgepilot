'use client'

import { AlertTriangle, ExternalLink } from 'lucide-react'
import type { PhaseInfo } from '@/lib/delegations/agent-phase'
import { cx } from '@/components/ui/primitives'

interface AgentPhaseIndicatorProps {
  info: PhaseInfo
  /** Whether to show the full progress signal below the pill. */
  showProgress?: boolean
  className?: string
}

/**
 * Compact phase pill with optional attention banner and turn progress.
 * Used inside DelegationCard to replace/augment the raw latest-log line.
 */
export function AgentPhaseIndicator({ info, showProgress = true, className }: AgentPhaseIndicatorProps) {
  const pillClass = cx(
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
    info.phase === 'escalation'
      ? 'border-rose-600/50 bg-rose-950/40 text-rose-300'
      : info.phase === 'failed'
        ? 'border-rose-800/50 bg-rose-950/30 text-rose-400'
        : info.phase === 'done'
          ? 'border-emerald-700/40 bg-emerald-950/30 text-emerald-300'
          : info.phase === 'pr_created'
            ? 'border-violet-700/40 bg-violet-950/30 text-violet-300'
            : 'border-white/[0.08] bg-white/[0.04] text-slate-300',
  )

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {/* Phase pill row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={pillClass}>
          <span aria-hidden>{info.emoji}</span>
          {info.label}
        </span>

        {/* Turn counter */}
        {info.turnsUsed !== undefined && info.maxTurns !== undefined && (
          <span className="font-mono text-[10px] text-slate-500">
            {info.turnsUsed}/{info.maxTurns} turns
          </span>
        )}

        {/* PR link */}
        {info.prUrl && (
          <a
            href={info.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="phase-pr-link"
            className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            PR
          </a>
        )}
      </div>

      {/* Attention banner */}
      {info.needsAttention && info.attentionReason && (
        <div className="flex items-start gap-1.5 rounded-md border border-rose-800/40 bg-rose-950/20 px-2 py-1">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
          <span className="text-[10px] text-rose-300 leading-snug">{info.attentionReason}</span>
        </div>
      )}

      {/* Progress signal */}
      {showProgress && info.progressSignal && !info.needsAttention && (
        <p className="font-mono text-[10px] text-slate-500 truncate">
          {info.progressSignal}
        </p>
      )}
    </div>
  )
}
