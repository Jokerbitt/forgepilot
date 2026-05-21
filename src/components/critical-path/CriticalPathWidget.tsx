'use client'

import { useEffect, useState } from 'react'

export interface CriticalPathIssue {
  id: string
  title: string
  status: string
  priority: number
  blockedBy: string[]
}

interface CriticalPathResult {
  issues: CriticalPathIssue[]
  totalEstimate: number
  longestChain: number
}

type LoadState = 'loading' | 'loaded' | 'error'

const MAX_VISIBLE = 8

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function getPriorityConfig(priority: number): {
  label: string
  className: string
} {
  switch (priority) {
    case 1:
      return { label: 'Urgent', className: 'border-red-500/40 bg-red-500/15 text-red-300' }
    case 2:
      return { label: 'High', className: 'border-orange-500/40 bg-orange-500/15 text-orange-300' }
    case 3:
      return { label: 'Medium', className: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300' }
    default:
      return { label: 'Low', className: 'border-gray-500/40 bg-gray-500/15 text-gray-400' }
  }
}

export function getStatusConfig(status: string): string {
  const normalized = status.toLowerCase()
  if (normalized.includes('done') || normalized.includes('completed')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  }
  if (normalized.includes('progress') || normalized.includes('started')) {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  }
  if (normalized.includes('blocked') || normalized.includes('wait')) {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  }
  if (normalized.includes('review')) {
    return 'border-violet-500/30 bg-violet-500/10 text-violet-300'
  }
  return 'border-gray-500/30 bg-gray-500/10 text-gray-400'
}

export function getVisibleIssues(
  issues: CriticalPathIssue[],
): { visible: CriticalPathIssue[]; hidden: number } {
  const visible = issues.slice(0, MAX_VISIBLE)
  const hidden = Math.max(0, issues.length - MAX_VISIBLE)
  return { visible, hidden }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CriticalPathWidget() {
  const [issues, setIssues] = useState<CriticalPathIssue[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/critical-path')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as CriticalPathResult
        if (!cancelled) {
          const rawIssues = Array.isArray(json.issues) ? json.issues : []
          // Normalise: ensure blockedBy is always an array
          const normalised: CriticalPathIssue[] = rawIssues.map(issue => ({
            ...issue,
            blockedBy: Array.isArray(issue.blockedBy) ? issue.blockedBy : [],
          }))
          setIssues(normalised)
          setLoadState('loaded')
        }
      } catch {
        if (!cancelled) setLoadState('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loadState === 'loading') {
    return (
      <section
        className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-sm shadow-black/20 animate-pulse"
        aria-label="Kritischer Pfad wird geladen"
      >
        <div className="h-5 bg-white/[0.06] rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 bg-white/[0.04] rounded-lg" />
          ))}
        </div>
      </section>
    )
  }

  if (loadState === 'error') {
    return (
      <section className="rounded-xl border border-rose-500/25 bg-rose-500/[0.05] p-6">
        <p className="text-sm text-rose-400">Kritischer Pfad nicht verfügbar</p>
      </section>
    )
  }

  const { visible, hidden } = getVisibleIssues(issues)

  return (
    <section
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-sm shadow-black/20"
      aria-label="Kritischer Pfad"
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-lg font-semibold text-white">Kritischer Pfad</h3>
        {issues.length > 0 && (
          <span className="text-xs text-slate-500">
            {issues.length} {issues.length === 1 ? 'Issue' : 'Issues'}
          </span>
        )}
      </div>

      {issues.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] p-5 text-center">
          <p className="text-sm text-slate-400">Kein kritischer Pfad erkannt</p>
        </div>
      ) : (
        <ol className="space-y-1">
          {visible.map((issue, index) => {
            const priority = getPriorityConfig(issue.priority)
            const statusClass = getStatusConfig(issue.status)
            const isLast = index === visible.length - 1 && hidden === 0

            return (
              <li key={issue.id}>
                <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
                  {/* Step number */}
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] text-[11px] font-semibold text-slate-400">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{issue.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {/* Status pill */}
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass}`}
                      >
                        {issue.status}
                      </span>
                      {/* Priority badge */}
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priority.className}`}
                      >
                        {priority.label}
                      </span>
                      {/* Blocked-by count */}
                      {issue.blockedBy.length > 0 && (
                        <span className="inline-flex items-center rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                          ⛓ {issue.blockedBy.length} blockiert
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chain icon between items */}
                {!isLast && (
                  <div className="flex items-center justify-start pl-5 py-0.5">
                    <span className="text-slate-600 text-xs">↓</span>
                  </div>
                )}
              </li>
            )
          })}

          {hidden > 0 && (
            <li className="pt-1 text-center text-xs text-slate-500">
              ... {hidden} weitere
            </li>
          )}
        </ol>
      )}
    </section>
  )
}
