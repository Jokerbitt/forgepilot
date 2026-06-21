'use client'

/**
 * DelegationFocusCard — Concept A status-driven primary area
 *
 * Replaces the generic metrics grid with a per-status focused view.
 * Each status gets a completely different layout that shows only what matters:
 *
 *   pending   → goal text + DoD preview + approve/reject CTAs
 *   approved  → confirmation + start CTA + preflight hint
 *   running   → elapsed timer + cost bar + last log line + stop CTA
 *   completed → results summary + file stats + PR link + merge CTA
 *   failed    → error message + retry/escalate CTAs
 *   cancelled → brief message + retry CTA
 */

import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'
import { ElapsedTimer, formatCompletedDuration } from '@/components/shared/ElapsedTimer'
import { CostMeter } from '@/components/delegation/CostMeter'

interface PrStatus {
  ciState: 'pending' | 'success' | 'failure' | 'error' | 'unknown'
  state: 'open' | 'closed' | 'merged'
}

interface MergeResult {
  merged: boolean
  mergeCommit?: string
  baseBranch?: string
}

export interface DelegationFocusCardProps {
  delegation: Delegation
  onApprove: () => void
  onReject: () => void
  onStart: () => void
  onStop: () => void
  onRetry: () => void
  onRetryEscalate: () => void
  onCreatePR: () => void
  onMerge: () => void
  creatingPR?: boolean
  merging?: boolean
  mergeResult?: MergeResult | null
  mergeError?: string | null
  prStatus?: PrStatus | null
  writebackCount?: number | null
}

const ROUTE_LABELS: Record<string, string> = {
  'local-agent':  'Lokaler Agent',
  'runner':       'Agent Runner',
  'ollama-agent': 'Ollama (lokal)',
  'direct-chat':  'Direkt-Chat',
  'n8n':          'n8n',
  'manual':       'Manuell',
}

function FileStats({ report }: { report: Delegation['summaryReport'] }) {
  if (!report) return null
  const added    = report.filesAdded?.length ?? 0
  const modified = report.filesModified?.length ?? 0
  const deleted  = report.filesDeleted?.length ?? 0
  const total    = added + modified + deleted
  if (total === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {added > 0 && (
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="font-mono">+{added}</span>
          <span className="text-gray-600">neu</span>
        </span>
      )}
      {modified > 0 && (
        <span className="flex items-center gap-1 text-blue-400">
          <span className="font-mono">~{modified}</span>
          <span className="text-gray-600">geändert</span>
        </span>
      )}
      {deleted > 0 && (
        <span className="flex items-center gap-1 text-red-400">
          <span className="font-mono">−{deleted}</span>
          <span className="text-gray-600">gelöscht</span>
        </span>
      )}
      {(report.testsAdded ?? 0) > 0 && (
        <span className="text-gray-500">· {report.testsAdded} Tests</span>
      )}
    </div>
  )
}

export function DelegationFocusCard({
  delegation: d,
  onApprove,
  onReject,
  onStart,
  onStop,
  onRetry,
  onRetryEscalate,
  onCreatePR,
  onMerge,
  creatingPR = false,
  merging = false,
  mergeResult = null,
  mergeError = null,
  prStatus = null,
  writebackCount = null,
}: DelegationFocusCardProps) {
  // ── derived flags ──────────────────────────────────────────────────
  const canApprove  = d.status === 'pending' && d.contract.requiresApproval && d.contract.riskClass !== 'C'
  const canStart    = d.status === 'approved'
  const canStop     = d.status === 'running'
  const canRetry    = d.status === 'failed' || d.status === 'cancelled'
  const canCreatePR = d.status === 'completed' && !d.summaryReport?.prUrl
  const isDone      = d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled'

  const lastLog = (d.logs ?? []).filter(l => l.type !== 'thought').slice(-1)[0]?.message
  const prNum   = d.summaryReport?.prUrl?.match(/\/pull\/(\d+)/)?.[1]

  // ── PENDING ────────────────────────────────────────────────────────
  if (d.status === 'pending') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          {/* Goal + meta */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-200 leading-relaxed line-clamp-3">
              {d.contract.goal}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-2 py-0.5 rounded border border-gray-700 text-[10px] text-gray-500">
                Risk {d.contract.riskClass}
              </span>
              {d.contract.maxBudgetUsd != null && (
                <span className="px-2 py-0.5 rounded border border-gray-700 text-[10px] text-gray-500">
                  ${d.contract.maxBudgetUsd.toFixed(2)} Budget
                </span>
              )}
              <span className="px-2 py-0.5 rounded border border-gray-700 text-[10px] text-gray-500">
                {ROUTE_LABELS[d.executionRoute] ?? d.executionRoute}
              </span>
            </div>
          </div>
          {/* CTAs */}
          <div className="flex flex-col gap-2 shrink-0">
            {canApprove && (
              <button
                onClick={onApprove}
                className="px-4 py-2 text-sm font-semibold bg-green-900/60 text-green-300 hover:bg-green-900 border border-green-800 rounded-lg transition-colors"
              >
                ✔ Freigeben
              </button>
            )}
            <button
              onClick={onReject}
              className="px-4 py-2 text-sm text-red-400 hover:bg-red-950/40 border border-red-900/50 rounded-lg transition-colors"
            >
              ✕ Ablehnen
            </button>
          </div>
        </div>

        {/* DoD preview */}
        {d.contract.definitionOfDone?.length > 0 && (
          <div className="border-t border-gray-800 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">Definition of Done</p>
            <ul className="space-y-1">
              {d.contract.definitionOfDone.slice(0, 4).map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                  <span className="mt-0.5 text-gray-700 shrink-0">○</span>
                  <span>{item}</span>
                </li>
              ))}
              {d.contract.definitionOfDone.length > 4 && (
                <li className="text-xs text-gray-700 pl-4">
                  +{d.contract.definitionOfDone.length - 4} weitere Kriterien
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // ── APPROVED ───────────────────────────────────────────────────────
  if (d.status === 'approved') {
    return (
      <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-300">✓ Freigegeben — bereit zum Starten</p>
            <p className="mt-1 text-xs text-gray-500">
              {ROUTE_LABELS[d.executionRoute] ?? d.executionRoute}
              {d.contract.maxBudgetUsd != null && ` · $${d.contract.maxBudgetUsd.toFixed(2)} Budget`}
              {` · Risk ${d.contract.riskClass}`}
            </p>
          </div>
          {canStart && (
            <button
              onClick={onStart}
              className="px-5 py-2.5 text-sm font-bold bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-lg shadow-blue-950/50"
            >
              ▶ Starten
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── RUNNING ────────────────────────────────────────────────────────
  if (d.status === 'running') {
    return (
      <div className="bg-violet-950/20 border border-violet-700/40 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          {/* Timer + cost */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              <ElapsedTimer
                startedAt={d.startedAt ?? d.updatedAt ?? d.createdAt}
                className="text-xl font-mono font-bold text-green-400 tabular-nums"
              />
            </div>
            <CostMeter
              actualCostUsd={d.actualCostUsd}
              estimateCostUsd={d.costEstimateUsd}
              maxBudgetUsd={d.contract.maxBudgetUsd}
            />
          </div>
          {canStop && (
            <button
              onClick={onStop}
              className="px-4 py-2 text-sm text-red-400 hover:bg-red-950/50 border border-red-900/50 rounded-lg transition-colors"
            >
              ⛔ Stoppen
            </button>
          )}
        </div>

        {/* Last agent log line */}
        {lastLog && (
          <div className="bg-gray-950/60 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 font-mono truncate">
              <span className="text-violet-500 mr-1.5">›</span>
              {lastLog}
            </p>
          </div>
        )}
      </div>
    )
  }

  // ── COMPLETED ──────────────────────────────────────────────────────
  if (d.status === 'completed') {
    const fileTotal = (d.summaryReport?.filesAdded?.length ?? 0)
      + (d.summaryReport?.filesModified?.length ?? 0)
      + (d.summaryReport?.filesDeleted?.length ?? 0)

    return (
      <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
              <span>✅ Fertig</span>
              {d.startedAt && d.completedAt && (
                <span className="text-emerald-600 font-normal text-xs">
                  · {formatCompletedDuration(d.startedAt, d.completedAt)}
                </span>
              )}
              {d.actualCostUsd != null && (
                <span className="text-emerald-600 font-normal text-xs">
                  · ${d.actualCostUsd.toFixed(3)}
                </span>
              )}
            </p>
            <FileStats report={d.summaryReport} />
          </div>

          {/* Action strip */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {d.summaryReport?.prUrl ? (
              <a
                href={d.summaryReport.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-800 bg-emerald-950/40 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                ⎇ PR #{prNum}
                {prStatus?.ciState === 'success' && <span className="text-green-400">· CI ✓</span>}
                {prStatus?.ciState === 'failure' && <span className="text-red-400">· CI ✗</span>}
                {prStatus?.ciState === 'pending' && <span className="text-yellow-400">· CI…</span>}
              </a>
            ) : canCreatePR ? (
              <button
                onClick={onCreatePR}
                disabled={creatingPR}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-800 bg-emerald-950/40 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40"
              >
                {creatingPR ? '⏳ Erstellt…' : '⤴ PR erstellen'}
              </button>
            ) : null}

            {!mergeResult ? (
              <button
                onClick={onMerge}
                disabled={merging}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-violet-800/60 bg-violet-950/30 text-violet-300 hover:border-violet-600 hover:text-violet-200 transition-colors disabled:opacity-40"
              >
                {merging ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border border-violet-400 border-t-transparent" />
                    Mergt…
                  </>
                ) : '⎇ In main mergen'}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-800/50 bg-emerald-950/20">
                <span className="text-xs text-emerald-400">✓ Gemergt</span>
                {mergeResult.mergeCommit && (
                  <span className="text-[10px] font-mono text-gray-600">{mergeResult.mergeCommit.slice(0, 7)}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scores row */}
        {(d.criticScore || (writebackCount !== null && writebackCount > 0) || fileTotal > 0) && (
          <div className="border-t border-emerald-900/40 pt-3 flex flex-wrap items-center gap-4">
            {d.criticScore && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Qualität</span>
                <span className={`text-sm font-bold ${
                  d.criticScore.verdict === 'approved' ? 'text-emerald-400' :
                  d.criticScore.verdict === 'needs-revision' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  🎯 {Math.round((d.criticScore.correctness + d.criticScore.efficiency + d.criticScore.drift) / 3)}pts
                </span>
              </div>
            )}
            {writebackCount !== null && writebackCount > 0 && (
              <Link
                href="/knowledge-cards"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Wissen</span>
                <span className="text-sm font-bold text-emerald-400">🧠 {writebackCount} Karten</span>
              </Link>
            )}
            {mergeError && (
              <p className="text-xs text-red-400 ml-auto">{mergeError}</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── FAILED ─────────────────────────────────────────────────────────
  if (d.status === 'failed') {
    return (
      <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
              <span>✗ Fehlgeschlagen</span>
              {d.startedAt && d.completedAt && (
                <span className="text-red-700 font-normal text-xs">
                  nach {formatCompletedDuration(d.startedAt, d.completedAt)}
                </span>
              )}
            </p>
            {d.errorMessage && (
              <p className="mt-2 text-xs text-red-300/60 font-mono line-clamp-2 leading-relaxed">
                {d.errorMessage}
              </p>
            )}
          </div>
          {canRetry && (
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={onRetry}
                className="px-4 py-2 text-sm font-semibold bg-blue-900/40 text-blue-400 hover:bg-blue-900 border border-blue-900/60 rounded-lg transition-colors"
              >
                🔄 Wiederholen
              </button>
              <button
                onClick={onRetryEscalate}
                className="px-4 py-2 text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 rounded-lg transition-colors"
                title="Mit bestem verfügbaren Cloud-Modell erneut versuchen"
              >
                ⬆ Cloud-Modell
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── CANCELLED ──────────────────────────────────────────────────────
  if (d.status === 'cancelled') {
    return (
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">⊘ Abgebrochen</p>
        {canRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
          >
            🔄 Wiederholen
          </button>
        )}
      </div>
    )
  }

  // ── REJECTED / fallback ────────────────────────────────────────────
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-sm text-gray-600">
        {d.status === 'rejected' ? '⊘ Abgelehnt' : d.status}
      </p>
    </div>
  )
}
