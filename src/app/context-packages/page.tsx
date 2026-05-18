'use client'

import { useEffect, useState } from 'react'
import type { ContextPackage } from '@/lib/context-packages/types'
import { Badge, EmptyState, StatusDot, cx } from '@/components/ui/primitives'

function readinessTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'danger'
}

function privacyLabel(mode: string): string {
  if (mode === 'local-only') return 'Lokal'
  if (mode === 'hybrid') return 'Hybrid'
  if (mode === 'cloud-approved') return 'Cloud'
  return mode
}

function privacyColor(mode: string): string {
  if (mode === 'local-only') return 'text-emerald-400'
  if (mode === 'hybrid') return 'text-amber-300'
  return 'text-sky-400'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function tokenBarWidth(count: number, budget: number): number {
  return Math.min(100, Math.round((count / Math.max(budget, 1)) * 100))
}

export default function ContextPackagesPage() {
  const [packages, setPackages] = useState<ContextPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ContextPackage | null>(null)

  useEffect(() => {
    fetch('/api/context-packages')
      .then(r => r.json())
      .then((d: ContextPackage[]) => setPackages(Array.isArray(d) ? d.slice().reverse() : []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Knowledge</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Context Packages</h1>
          <p className="mt-2 text-sm text-slate-400">Token-optimierte Kontextpakete für Agenten-Ausführungen.</p>
        </header>

        {loading ? (
          <p className="text-sm text-slate-500">Lade Context Packages…</p>
        ) : packages.length === 0 ? (
          <EmptyState
            title="Noch keine Context Packages"
            description="Packages werden automatisch beim Start einer Delegation gebaut oder können über die API erstellt werden."
          />
        ) : (
          <div className="flex gap-4">
            {/* List */}
            <div className={cx('flex-1 min-w-0 space-y-2', selected ? 'hidden sm:block sm:w-1/2 sm:flex-none' : '')}>
              {packages.map(pkg => {
                const tone = readinessTone(pkg.readinessScore)
                const barWidth = tokenBarWidth(pkg.tokenCount, pkg.tokenBudget)
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelected(selected?.id === pkg.id ? null : pkg)}
                    className={cx(
                      'w-full rounded-xl border p-4 text-left transition-all',
                      selected?.id === pkg.id
                        ? 'border-sky-700/60 bg-sky-900/10'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <StatusDot tone={tone} />
                          <span className={cx(
                            'text-xs font-bold',
                            tone === 'success' ? 'text-emerald-400' : tone === 'warning' ? 'text-amber-300' : 'text-red-400'
                          )}>
                            {pkg.readinessScore}%
                          </span>
                          <span className={cx('text-xs font-medium', privacyColor(pkg.privacyMode))}>
                            {privacyLabel(pkg.privacyMode)}
                          </span>
                        </div>
                        <p className="truncate font-medium text-white">{pkg.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{pkg.objective}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">{pkg.tokenCount.toLocaleString()} tk</p>
                        <p className="text-[10px] text-slate-700">{formatDate(pkg.createdAt)}</p>
                      </div>
                    </div>
                    {/* Token bar */}
                    <div className="mt-3 h-1 w-full rounded-full bg-slate-800">
                      <div
                        className={cx('h-1 rounded-full', barWidth > 90 ? 'bg-red-500' : barWidth > 70 ? 'bg-amber-400' : 'bg-emerald-500')}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-700">
                      <span>{pkg.tokenCount.toLocaleString()} / {pkg.tokenBudget.toLocaleString()} Tokens</span>
                      <span>{pkg.sources.length} Quellen</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="w-full sm:w-80 sm:flex-none">
                <div className="sticky top-20 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detail</p>
                    <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300">✕</button>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{selected.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{selected.objective}</p>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Readiness</dt>
                      <dd className={cx('font-bold', readinessTone(selected.readinessScore) === 'success' ? 'text-emerald-400' : readinessTone(selected.readinessScore) === 'warning' ? 'text-amber-300' : 'text-red-400')}>
                        {selected.readinessScore}%
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Privacy</dt>
                      <dd className={privacyColor(selected.privacyMode)}>{privacyLabel(selected.privacyMode)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Tokens</dt>
                      <dd className="text-slate-300">{selected.tokenCount.toLocaleString()} / {selected.tokenBudget.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Quellen</dt>
                      <dd className="text-slate-300">{selected.sources.length}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Memory Cards</dt>
                      <dd className="text-slate-300">{selected.memoryCardIds.length}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Erstellt</dt>
                      <dd className="text-slate-400">{formatDate(selected.createdAt)}</dd>
                    </div>
                  </dl>

                  {selected.blockers.length > 0 && (
                    <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-400">Blocker</p>
                      <ul className="space-y-1">
                        {selected.blockers.map((b, i) => (
                          <li key={i} className="flex items-start gap-1 text-xs text-amber-300">
                            <span className="mt-0.5 shrink-0">⚠</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selected.sources.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Quellen</p>
                      <div className="space-y-1.5">
                        {selected.sources.map(src => (
                          <div key={src.sourceId} className={cx('flex items-center justify-between rounded px-2 py-1.5 text-xs', src.included ? 'bg-slate-800' : 'bg-slate-900 opacity-50')}>
                            <span className="truncate text-slate-300">{src.label}</span>
                            <Badge>{src.tokenCount} tk</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
