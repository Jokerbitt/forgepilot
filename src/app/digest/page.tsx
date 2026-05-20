'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ActivityDigest, DigestPeriod, DigestItem } from '@/lib/digest/digest-builder'

const PERIOD_LABELS: Record<DigestPeriod, string> = {
  daily: 'Letzte 24 Stunden',
  weekly: 'Letzte 7 Tage',
}

const SEVERITY_STYLES = {
  ok:       'text-emerald-400',
  warning:  'text-amber-400',
  critical: 'text-red-400',
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-600">{sub}</p>}
    </div>
  )
}

function ItemRow({ item }: { item: DigestItem }) {
  const colorClass = item.severity ? SEVERITY_STYLES[item.severity] : 'text-slate-400'
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`min-w-0 flex-1 text-sm font-medium ${colorClass}`}>{item.label}</span>
      <span className="shrink-0 text-sm text-slate-500">{item.value}</span>
      {item.link && (
        <Link href={item.link} className="shrink-0 text-xs text-violet-400 hover:text-violet-300">→</Link>
      )}
    </div>
  )
}

export default function DigestPage() {
  const [period, setPeriod] = useState<DigestPeriod>('daily')
  const [digest, setDigest] = useState<ActivityDigest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/digest/activity?period=${period}`)
      .then(r => r.ok ? r.json() as Promise<ActivityDigest> : r.json().then(e => { throw new Error((e as { error?: string }).error ?? 'Fehler') }))
      .then(data => setDigest(data))
      .catch(e => setError(String(e.message ?? e)))
      .finally(() => setLoading(false))
  }, [period])

  function handleEmailExport() {
    if (!digest) return
    const subject = encodeURIComponent(`ForgePilot Digest — ${PERIOD_LABELS[period]}`)
    const body = encodeURIComponent(digest.emailBody)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const s = digest?.stats

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Aktivitäts-Digest</h1>
            <p className="mt-1 text-sm text-slate-400">Überblick über alle ForgePilot-Aktivitäten</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Period toggle */}
            <div className="flex rounded-lg border border-slate-700 overflow-hidden">
              {(['daily', 'weekly'] as DigestPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm transition-colors ${period === p ? 'bg-violet-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  {p === 'daily' ? '24h' : '7 Tage'}
                </button>
              ))}
            </div>
            <button
              onClick={handleEmailExport}
              disabled={!digest}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-40"
            >
              ✉ Email-Export
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-700/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
            ))}
          </div>
        )}

        {digest && s && (
          <>
            {/* Stats row */}
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Benachrichtigungen"
                value={s.totalNotifications}
                sub={s.unreadNotifications > 0 ? `${s.unreadNotifications} ungelesen` : undefined}
              />
              <StatCard
                label="Delegationen abgeschlossen"
                value={s.completedDelegations}
                sub={s.failedDelegations > 0 ? `${s.failedDelegations} fehlgeschlagen` : undefined}
              />
              <StatCard
                label="Agent Runs"
                value={s.completedRuns}
                sub={s.failedRuns > 0 ? `${s.failedRuns} Fehler` : undefined}
              />
              <StatCard
                label="Kosten"
                value={s.totalRunCostUsd > 0 ? `$${s.totalRunCostUsd.toFixed(4)}` : '–'}
                sub="AI Runs"
              />
            </div>

            {/* Alert banner for critical items */}
            {s.criticalNotifications > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-700/60 bg-red-950/30 px-4 py-3">
                <span className="text-red-400">⚠</span>
                <p className="text-sm text-red-300">
                  {s.criticalNotifications} kritische Benachrichtigung{s.criticalNotifications !== 1 ? 'en' : ''} im Zeitraum
                </p>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-4">
              {digest.sections.map(section => (
                <div key={section.title} className="rounded-xl border border-slate-800 bg-slate-900">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{section.title}</h2>
                  </div>
                  <div className="divide-y divide-slate-800 px-4">
                    {section.items.map((item, i) => (
                      <ItemRow key={`${section.title}-${i}`} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-slate-600">
              Generiert: {new Date(digest.generatedAt).toLocaleString('de-DE')} · Seit: {new Date(digest.since).toLocaleString('de-DE')}
            </p>
          </>
        )}
      </main>
    </div>
  )
}
