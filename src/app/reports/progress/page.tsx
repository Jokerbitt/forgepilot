'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { ProgressReport, ProgressItem, ProgressSection } from '@/app/api/reports/progress/route'

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  done:    { dot: 'bg-emerald-400', badge: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40', icon: '✅', label: 'Erledigt' },
  ok:      { dot: 'bg-emerald-400', badge: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40', icon: '✓',  label: 'OK' },
  warning: { dot: 'bg-amber-400',   badge: 'bg-amber-900/30 text-amber-400 border-amber-800/40',       icon: '⚠', label: 'Warnung' },
  pending: { dot: 'bg-slate-500',   badge: 'bg-slate-800 text-slate-400 border-slate-700',             icon: '○',  label: 'Offen' },
  info:    { dot: 'bg-sky-400',     badge: 'bg-sky-900/30 text-sky-400 border-sky-800/40',             icon: 'ℹ',  label: 'Info' },
}

const SECTION_ICONS: Record<string, string> = {
  'Was wurde bereits gemacht': '🏗',
  'Was funktioniert gut':       '🟢',
  'Was wurde getestet':         '🧪',
  'Was sollte noch gemacht werden': '📋',
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ report }: { report: ProgressReport }) {
  const { summary } = report
  const testRate = summary.testsTotal > 0
    ? Math.round((summary.testsPassed / summary.testsTotal) * 100)
    : 0
  const delegationRate = (summary.completedDelegations + summary.failedDelegations) > 0
    ? Math.round((summary.completedDelegations / (summary.completedDelegations + summary.failedDelegations)) * 100)
    : 0
  const wpRate = summary.workPackagesTotal > 0
    ? Math.round((summary.workPackagesDone / summary.workPackagesTotal) * 100)
    : 0

  const stats = [
    { label: 'Briefs akzeptiert', value: `${summary.acceptedBriefs}/${summary.totalBriefs}`, color: 'text-emerald-400' },
    { label: 'Tests bestanden', value: `${summary.testsPassed.toLocaleString()} (${testRate}%)`, color: testRate === 100 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Delegationen OK', value: `${summary.completedDelegations} (${delegationRate}%)`, color: delegationRate >= 80 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Work Packages', value: `${summary.workPackagesDone}/${summary.workPackagesTotal} (${wpRate}%)`, color: 'text-sky-400' },
    { label: 'Ausstehend', value: String(summary.pendingDelegations), color: summary.pendingDelegations > 0 ? 'text-amber-400' : 'text-slate-500' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {stats.map(s => (
        <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Progress item ─────────────────────────────────────────────────────────────

function ProgressItemRow({ item }: { item: ProgressItem }) {
  const config = STATUS_CONFIG[item.status]

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-200 font-medium">{item.label}</span>
          {item.count !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${config.badge}`}>
              {item.count}
            </span>
          )}
          {item.url && (
            <Link
              href={item.url}
              className="text-xs text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
            >
              →
            </Link>
          )}
        </div>
        {item.detail && (
          <p className="text-xs text-slate-500 mt-0.5 truncate" title={item.detail}>{item.detail}</p>
        )}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${config.badge}`}>
        {config.label}
      </span>
    </div>
  )
}

// ─── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: ProgressSection }) {
  const icon = SECTION_ICONS[section.title] ?? '📌'
  const doneCount = section.items.filter(i => i.status === 'done' || i.status === 'ok').length
  const totalCount = section.items.length

  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/40">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2">
          <span>{icon}</span>
          {section.title}
        </h2>
        <span className="text-xs text-slate-500 font-mono">
          {doneCount}/{totalCount} OK
        </span>
      </div>
      <div className="px-4">
        {section.items.map((item, i) => (
          <ProgressItemRow key={i} item={item} />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProgressReportPage() {
  const [report, setReport] = useState<ProgressReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reports/progress', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setReport(await res.json() as ProgressReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Lade Projektfortschritt…</div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 text-red-400">
            {error ?? 'Unbekannter Fehler'}
          </div>
        </div>
      </div>
    )
  }

  const generatedAt = new Date(report.generatedAt).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Projektfortschritt</h1>
            <p className="text-sm text-slate-500 mt-1">
              Stand: {generatedAt}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-sm text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded border border-slate-700 hover:border-slate-600 transition-colors"
            >
              ← Command Center
            </Link>
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="text-sm text-sky-400 hover:text-sky-300 px-3 py-1.5 rounded border border-sky-800/40 hover:border-sky-700/60 transition-colors disabled:opacity-50"
            >
              {refreshing ? 'Lädt…' : '↻ Aktualisieren'}
            </button>
          </div>
        </div>

        {/* Summary */}
        <SummaryBar report={report} />

        {/* Sections — 2-column grid on larger screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {report.sections.map(section => (
            <SectionCard key={section.title} section={section} />
          ))}
        </div>

        {/* Quick links */}
        <div className="border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Schnellzugriff</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/project-briefs', label: 'Project Briefs' },
              { href: '/delegations', label: 'Delegationen' },
              { href: '/work-items', label: 'Work Items' },
              { href: '/orchestrations', label: 'Orchestrierungen' },
              { href: '/governance', label: 'DSGVO Governance' },
              { href: '/settings', label: 'Einstellungen' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
