'use client'

/**
 * DelegationErrorCard — M4/M5: Prominent, human-readable error display.
 *
 * Shows when a delegation has failed with:
 * - Classified error title + detail (German, actionable)
 * - Fix instructions with links
 * - Extracted error snippet from logs
 * - Quick action buttons (retry, fix-delegation)
 */

import Link from 'next/link'
import { AlertCircle, ArrowRight, RefreshCw, XCircle } from 'lucide-react'
import { classifyError, extractErrorSnippet } from '@/lib/runner-health/error-classifier'
import type { Delegation } from '@/lib/models/delegation'

interface Props {
  delegation: Delegation
  onRetry?: () => void
  onReviewRetry?: () => void
}

const CATEGORY_ICON: Record<string, string> = {
  auth:         '🔑',
  billing:      '💳',
  rate_limit:   '⏱',
  network:      '🌐',
  tool_missing: '🔧',
  git:          '⑂',
  build:        '🏗',
  test:         '🧪',
  budget:       '💰',
  process:      '💀',
  workspace:    '📁',
  unknown:      '❓',
}

export function DelegationErrorCard({ delegation, onRetry, onReviewRetry }: Props) {
  if (delegation.status !== 'failed') return null

  // Build raw error text from errorMessage + last log entries
  const logText = (delegation.logs ?? [])
    .slice(-30)
    .map(l => l.message)
    .join('\n')
  const rawOutput = [delegation.errorMessage ?? '', logText].join('\n')
  const classified = classifyError(rawOutput)
  const snippet = extractErrorSnippet(logText, 8)

  // If the delegation already has a friendly errorMessage, use it as-is
  const displayTitle = delegation.errorMessage?.includes('—')
    ? delegation.errorMessage.split('—')[0].trim()
    : classified.title

  const displayFix = delegation.errorMessage?.includes('—')
    ? delegation.errorMessage.split('—').slice(1).join('—').trim()
    : classified.fix

  const icon = CATEGORY_ICON[classified.category] ?? '❓'

  return (
    <div className="rounded-xl border border-red-700/40 bg-red-950/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-950/50 text-xl">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm font-bold text-red-200">{displayTitle}</p>
          </div>
          <p className="mt-1 text-xs text-slate-400 leading-4">{classified.detail}</p>
        </div>
      </div>

      {/* Fix instructions */}
      <div className="border-t border-red-800/20 bg-red-950/20 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200 leading-4">
            <span className="font-semibold">Fix: </span>
            {displayFix}
            {classified.fixHref && (
              <>
                {' '}
                <Link href={classified.fixHref} className="text-violet-400 hover:underline">
                  → Einstellungen öffnen
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Error snippet */}
      {snippet && classified.category !== 'unknown' && (
        <details className="border-t border-red-800/20">
          <summary className="px-4 py-2 text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition-colors">
            Technische Details anzeigen
          </summary>
          <pre className="px-4 pb-3 text-[10px] text-slate-500 font-mono leading-4 overflow-x-auto whitespace-pre-wrap">
            {snippet}
          </pre>
        </details>
      )}

      {/* Actions */}
      {(onRetry || onReviewRetry) && (
        <div className="border-t border-red-800/20 px-4 py-3 flex items-center gap-2 flex-wrap">
          {onRetry && classified.category !== 'auth' && classified.category !== 'tool_missing' && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/[0.15] hover:text-white"
            >
              <RefreshCw className="h-3 w-3" />
              Erneut starten
            </button>
          )}
          {onReviewRetry && (
            <button
              onClick={onReviewRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700/40 bg-violet-950/20 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-950/40"
            >
              <ArrowRight className="h-3 w-3" />
              Fix-Delegation mit Fehler-Kontext
            </button>
          )}
        </div>
      )}
    </div>
  )
}
