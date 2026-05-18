'use client'

import { useEffect, useState } from 'react'
import type { RoutingDecision } from '@/lib/models/model-router'
import { Badge, EmptyState, StatusDot, cx } from '@/components/ui/primitives'
import { DEFAULT_PROFILES } from '@/lib/model-router/profiles'
import type { ModelProfile } from '@/lib/models/model-router'

function costColor(c: string): string {
  if (c === 'free-local') return 'text-emerald-400'
  if (c === 'included-subscription') return 'text-sky-400'
  if (c === 'metered-low') return 'text-amber-300'
  return 'text-red-400'
}

function costLabel(c: string): string {
  if (c === 'free-local') return 'Kostenlos lokal'
  if (c === 'included-subscription') return 'Abo inklusive'
  if (c === 'metered-low') return 'Gering'
  if (c === 'metered-high') return 'Hoch'
  return c
}

function healthTone(h: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (h === 'healthy') return 'success'
  if (h === 'degraded') return 'warning'
  if (h === 'offline') return 'danger'
  return 'neutral'
}

function modeColor(m: string): string {
  if (m === 'local') return 'text-emerald-400'
  if (m === 'desktop-agent') return 'text-sky-300'
  if (m === 'cloud') return 'text-violet-400'
  return 'text-slate-400'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'profiles' | 'decisions'

export default function ModelRouterPage() {
  const [tab, setTab] = useState<Tab>('profiles')
  const [decisions, setDecisions] = useState<RoutingDecision[]>([])
  const [loading, setLoading] = useState(false)
  const profiles: ModelProfile[] = DEFAULT_PROFILES

  useEffect(() => {
    if (tab !== 'decisions') return
    setLoading(true)
    fetch('/api/model-router')
      .then(r => r.json())
      .then((d: RoutingDecision[]) => setDecisions(Array.isArray(d) ? d.slice().reverse() : []))
      .catch(() => setDecisions([]))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">System</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Model Router</h1>
          <p className="mt-2 text-sm text-slate-400">Provider-Profile, Routing-Entscheidungen und Health-Status.</p>
        </header>

        <div className="mb-6 flex gap-1 border-b border-slate-800">
          {(['profiles', 'decisions'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={cx(
              'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors capitalize',
              tab === t ? 'border-sky-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
            )}>
              {t === 'profiles' ? `Provider (${profiles.length})` : `Routing-Log (${decisions.length})`}
            </button>
          ))}
        </div>

        {tab === 'profiles' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {profiles.map(p => (
              <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusDot tone={healthTone(p.healthStatus)} />
                      <span className="text-sm font-semibold text-white">{p.modelName}</span>
                    </div>
                    <p className={cx('mt-0.5 text-xs font-medium', modeColor(p.executionMode))}>
                      {p.provider} · {p.executionMode}
                    </p>
                  </div>
                  <span className={cx('text-xs font-medium', costColor(p.costClass))}>
                    {costLabel(p.costClass)}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-1">
                  {p.recommendedWorkloads.slice(0, 4).map(w => (
                    <Badge key={w}>{w}</Badge>
                  ))}
                  {p.recommendedWorkloads.length > 4 && (
                    <span className="text-xs text-slate-600">+{p.recommendedWorkloads.length - 4}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {p.privacyModes.map(m => (
                    <span key={m} className={cx(
                      'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                      m === 'local-only' ? 'border-emerald-800/50 bg-emerald-900/20 text-emerald-400' :
                      m === 'hybrid' ? 'border-amber-800/50 bg-amber-900/20 text-amber-300' :
                      'border-sky-800/50 bg-sky-900/20 text-sky-400'
                    )}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : loading ? (
          <p className="text-sm text-slate-500">Lade Routing-Log…</p>
        ) : decisions.length === 0 ? (
          <EmptyState
            title="Noch keine Routing-Entscheidungen"
            description="Entscheidungen werden automatisch beim Start von Delegationen gespeichert."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Modell</th>
                  <th className="px-4 py-3">Workload</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Privacy</th>
                  <th className="hidden px-4 py-3 md:table-cell">Grund</th>
                  <th className="px-4 py-3">Zeit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {decisions.map(d => (
                  <tr key={d.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-white">{d.selectedModel}</td>
                    <td className="px-4 py-3"><Badge>{d.workload}</Badge></td>
                    <td className="hidden px-4 py-3 text-xs text-slate-400 sm:table-cell">{d.privacyMode}</td>
                    <td className="hidden max-w-xs px-4 py-3 text-xs text-slate-500 md:table-cell">
                      <span className="line-clamp-1">{d.reason}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDate(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
