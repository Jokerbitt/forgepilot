'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cx } from '@/components/ui/primitives'
import type { ActivityDigest, DigestPeriod, DigestItem } from '@/lib/digest/digest-builder'
import type { BriefingData } from '@/app/api/briefing/route'

// ─── Digest helpers ────────────────────────────────────────────────────────────

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

// ─── Briefing helpers ──────────────────────────────────────────────────────────

function priorityColor(p: number): string {
  if (p === 1) return 'bg-red-500/20 text-red-300'
  if (p === 2) return 'bg-orange-500/20 text-orange-300'
  if (p === 3) return 'bg-yellow-500/20 text-yellow-300'
  return 'bg-slate-500/20 text-slate-400'
}

function priorityLabel(p: number): string {
  if (p === 1) return 'Urgent'
  if (p === 2) return 'High'
  if (p === 3) return 'Medium'
  return 'Low'
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'vor weniger als 1h'
  if (hours < 24) return `vor ${hours}h`
  const days = Math.floor(hours / 24)
  return `vor ${days}d`
}

// ─── Inner component (needs useSearchParams) ──────────────────────────────────

function DigestInner() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'briefing' ? 'briefing' : 'digest'

  const [tab, setTab] = useState<'digest' | 'briefing'>(initialTab as 'digest' | 'briefing')

  // Digest state
  const [period, setPeriod] = useState<DigestPeriod>('daily')
  const [digest, setDigest] = useState<ActivityDigest | null>(null)
  const [digestLoading, setDigestLoading] = useState(true)
  const [digestError, setDigestError] = useState('')

  // Briefing state
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingError, setBriefingError] = useState('')

  useEffect(() => {
    setDigestLoading(true)
    setDigestError('')
    fetch(`/api/digest/activity?period=${period}`)
      .then(r => r.ok ? r.json() as Promise<ActivityDigest> : r.json().then(e => { throw new Error((e as { error?: string }).error ?? 'Fehler') }))
      .then(data => setDigest(data))
      .catch(e => setDigestError(String((e as Error).message ?? e)))
      .finally(() => setDigestLoading(false))
  }, [period])

  useEffect(() => {
    if (tab !== 'briefing' || briefing) return
    setBriefingLoading(true)
    setBriefingError('')
    fetch('/api/briefing')
      .then(r => r.ok ? r.json() as Promise<BriefingData> : Promise.reject(new Error('Briefing nicht verfügbar')))
      .then(data => setBriefing(data))
      .catch(e => setBriefingError(String((e as Error).message ?? e)))
      .finally(() => setBriefingLoading(false))
  }, [tab, briefing])

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
            <h1 className="text-2xl font-semibold text-white">Tagesübersicht</h1>
            <p className="mt-1 text-sm text-slate-400">Aktivitäten &amp; Morning Briefing</p>
          </div>
          {tab === 'digest' && (
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                {(['daily', 'weekly'] as DigestPeriod[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-sm transition-colors ${period === p ? 'bg-violet-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                    {p === 'daily' ? '24h' : '7 Tage'}
                  </button>
                ))}
              </div>
              <button onClick={handleEmailExport} disabled={!digest}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-40">
                ✉ Email-Export
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          <button onClick={() => setTab('digest')}
            className={cx('flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
              tab === 'digest' ? 'bg-violet-500/20 text-violet-200' : 'text-slate-500 hover:text-slate-300')}>
            Aktivitäts-Digest
          </button>
          <button onClick={() => setTab('briefing')}
            className={cx('flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
              tab === 'briefing' ? 'bg-violet-500/20 text-violet-200' : 'text-slate-500 hover:text-slate-300')}>
            Morning Briefing
          </button>
        </div>

        {/* ── Tab: Digest ── */}
        {tab === 'digest' && (
          <>
            {digestError && (
              <div className="mb-6 rounded-xl border border-red-700/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">{digestError}</div>
            )}
            {digestLoading && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
                ))}
              </div>
            )}
            {digest && s && (
              <>
                <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Benachrichtigungen" value={s.totalNotifications}
                    sub={s.unreadNotifications > 0 ? `${s.unreadNotifications} ungelesen` : undefined} />
                  <StatCard label="Delegationen abgeschlossen" value={s.completedDelegations}
                    sub={s.failedDelegations > 0 ? `${s.failedDelegations} fehlgeschlagen` : undefined} />
                  <StatCard label="Agent Runs" value={s.completedRuns}
                    sub={s.failedRuns > 0 ? `${s.failedRuns} Fehler` : undefined} />
                  <StatCard label="Kosten"
                    value={s.totalRunCostUsd > 0 ? `$${s.totalRunCostUsd.toFixed(4)}` : '–'} sub="AI Runs" />
                </div>
                {s.criticalNotifications > 0 && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-700/60 bg-red-950/30 px-4 py-3">
                    <span className="text-red-400">⚠</span>
                    <p className="text-sm text-red-300">
                      {s.criticalNotifications} kritische Benachrichtigung{s.criticalNotifications !== 1 ? 'en' : ''} im Zeitraum
                    </p>
                  </div>
                )}
                <div className="space-y-4">
                  {digest.sections.map(section => (
                    <div key={section.title} className="rounded-xl border border-slate-800 bg-slate-900">
                      <div className="border-b border-slate-800 px-4 py-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{section.title}</h2>
                      </div>
                      <div className="divide-y divide-slate-800 px-4">
                        {section.items.map((item, i) => <ItemRow key={`${section.title}-${i}`} item={item} />)}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-600">
                  Generiert: {new Date(digest.generatedAt).toLocaleString('de-DE')} · Seit: {new Date(digest.since).toLocaleString('de-DE')}
                </p>
              </>
            )}
          </>
        )}

        {/* ── Tab: Briefing ── */}
        {tab === 'briefing' && (
          <>
            {briefingError && (
              <div className="mb-6 rounded-xl border border-red-700/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">{briefingError}</div>
            )}
            {briefingLoading && (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
                ))}
              </div>
            )}
            {briefing && <BriefingContent data={briefing} />}
          </>
        )}

      </main>
    </div>
  )
}

export default function DigestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
      </div>
    }>
      <DigestInner />
    </Suspense>
  )
}

// ─── Briefing sub-component ───────────────────────────────────────────────────

function BriefingContent({ data }: { data: BriefingData }) {
  const healthBadge = data.health.overall === 'ok'
    ? { label: 'OK', className: 'bg-emerald-500/20 text-emerald-300' }
    : data.health.overall === 'warn'
    ? { label: 'Warnung', className: 'bg-yellow-500/20 text-yellow-300' }
    : { label: 'Fehler', className: 'bg-red-500/20 text-red-300' }

  const linearHasAny =
    data.linear.inProgress.length > 0 ||
    data.linear.dueToday.length > 0 ||
    data.linear.blocked.length > 0

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Aktualisiert: {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Linear */}
        <BriefCard title="Linear — Heute">
          {!linearHasAny ? (
            <p className="px-3 py-2 text-sm text-slate-600 italic">Keine offenen Tickets</p>
          ) : (
            <div className="space-y-3">
              {data.linear.inProgress.length > 0 && (
                <div>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">In Progress</p>
                  {data.linear.inProgress.map(issue => (
                    <a key={issue.id} href={issue.url} target="_blank" rel="noreferrer"
                      className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                      <span className="min-w-0 flex-1 text-sm text-slate-300 group-hover:text-white truncate">{issue.title}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityColor(issue.priority)}`}>
                        {priorityLabel(issue.priority)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {data.linear.dueToday.length > 0 && (
                <div>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-red-500">Fällig heute</p>
                  {data.linear.dueToday.map(issue => (
                    <a key={`due-${issue.id}`} href={issue.url} target="_blank" rel="noreferrer"
                      className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                      <span className="min-w-0 flex-1 text-sm text-slate-300 group-hover:text-white truncate">{issue.title}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityColor(issue.priority)}`}>
                        {priorityLabel(issue.priority)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {data.linear.blocked.length > 0 && (
                <div>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-orange-500">Blockiert</p>
                  {data.linear.blocked.map(issue => (
                    <a key={`blocked-${issue.id}`} href={issue.url} target="_blank" rel="noreferrer"
                      className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                      <span className="min-w-0 flex-1 text-sm text-slate-300 group-hover:text-white truncate">{issue.title}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityColor(issue.priority)}`}>
                        {priorityLabel(issue.priority)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </BriefCard>

        {/* GitHub PRs */}
        <BriefCard title="GitHub PRs">
          {data.github.openPRs.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-600 italic">Keine offenen PRs</p>
          ) : (
            <div className="space-y-0.5">
              {data.github.openPRs.map(pr => (
                <a key={pr.number} href={pr.url} target="_blank" rel="noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-300 group-hover:text-white">#{pr.number} {pr.title}</span>
                    <span className="text-[11px] text-slate-500">{pr.author} · {timeAgo(pr.updatedAt)}</span>
                  </span>
                  {pr.draft && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-500/20 text-slate-400">Draft</span>
                  )}
                </a>
              ))}
            </div>
          )}
        </BriefCard>

        {/* Delegationen */}
        <BriefCard title="Delegationen">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-2xl font-bold text-violet-300">{data.delegations.pendingApproval}</p>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">Warten auf Freigabe</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-2xl font-bold text-emerald-300">{data.delegations.inProgress}</p>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">Laufen</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-2xl font-bold text-blue-300">{data.delegations.completedToday}</p>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">Heute fertig</p>
            </div>
          </div>
          <div className="mt-3 px-1">
            <Link href="/delegations" className="text-xs font-medium text-violet-400 transition-colors hover:text-violet-300">
              Alle Delegationen →
            </Link>
          </div>
        </BriefCard>

        {/* System Health */}
        <BriefCard title="System Health">
          <div className="flex items-center gap-3 px-3 py-2">
            <span className={`rounded-lg px-3 py-1.5 text-sm font-bold ${healthBadge.className}`}>{healthBadge.label}</span>
            <p className="min-w-0 flex-1 text-sm text-slate-400">{data.health.summary}</p>
          </div>
          <div className="mt-3 px-3">
            <Link href="/dev/health" className="text-xs font-medium text-violet-400 transition-colors hover:text-violet-300">
              Details ansehen →
            </Link>
          </div>
        </BriefCard>

      </div>
    </div>
  )
}

function BriefCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">{title}</h2>
      {children}
    </div>
  )
}
