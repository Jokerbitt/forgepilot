'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'
import type { DashboardStats } from '@/app/api/dashboard/stats/route'
import { Badge, StatusDot, buttonClassName, cx } from '@/components/ui/primitives'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FocusedData {
  delegations: Delegation[]
  stats: DashboardStats | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CommandCenterOverview() {
  const [data, setData] = useState<FocusedData>({ delegations: [], stats: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [delegationsRes, statsRes] = await Promise.allSettled([
        fetch('/api/delegations').then(res => res.json() as Promise<Delegation[]>),
        fetch('/api/dashboard/stats').then(res => res.json() as Promise<DashboardStats>),
      ])

      if (cancelled) return

      const delegations =
        delegationsRes.status === 'fulfilled' && Array.isArray(delegationsRes.value)
          ? delegationsRes.value
          : []
      const stats = statsRes.status === 'fulfilled' ? statsRes.value : null

      setData({ delegations, stats })
    }

    void load()
    const interval = window.setInterval(() => { void load() }, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const { delegations, stats } = data

  const pending = delegations.filter(d => d.status === 'pending')
  const running = delegations.filter(d => d.status === 'running')
  const recentDone = delegations
    .filter(d => d.status === 'completed' || d.status === 'failed')
    .sort((a, b) => {
      const aTime = a.updatedAt ?? a.createdAt ?? ''
      const bTime = b.updatedAt ?? b.createdAt ?? ''
      return bTime.localeCompare(aTime)
    })
    .slice(0, 5)

  const totalStats = stats?.delegations ?? null

  return (
    <div className="space-y-5">
      {/* ── Row 1: CTA + Status-Kacheln ─────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Kachel 1 — Neue Delegation (Haupt-CTA, 2/3 Breite) */}
        <NewDelegationCard />

        {/* Kacheln 2 + 3 in einer Spalte */}
        <div className="flex flex-col gap-5">
          <PendingApprovalsCard count={pending.length} />
          <ActiveExecutionsCard running={running} />
        </div>
      </div>

      {/* ── Row 2: Letzte Aktivität ──────────────────────────────────────── */}
      <RecentActivityCard entries={recentDone} />

      {/* ── Row 3: Mini-Statistik ────────────────────────────────────────── */}
      {totalStats && <MiniStats stats={totalStats} />}
    </div>
  )
}

// ─── Kachel 1: Neue Delegation (Haupt-CTA) ──────────────────────────────────

function NewDelegationCard() {
  return (
    <Link
      href="/delegations?new=1"
      className={cx(
        'group relative lg:col-span-2 flex flex-col justify-between overflow-hidden rounded-xl border border-violet-500/30 p-8',
        'bg-gradient-to-br from-violet-600/20 via-indigo-600/15 to-[#0d0d15]',
        'transition-all duration-200 hover:border-violet-400/50 hover:from-violet-600/25',
      )}
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Nächster Schritt
        </p>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Was soll als nächstes<br />delegiert werden?
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Vom Brief zur Ausführung in einem Schritt — Ziel definieren, KI übernimmt den Rest.
        </p>
      </div>

      <div className="mt-8">
        <span
          className={cx(
            buttonClassName('primary', 'inline-flex gap-2 bg-white text-violet-700 border-white/90'),
            'group-hover:bg-white/90',
          )}
        >
          Delegation starten
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  )
}

// ─── Kachel 2: Ausstehende Genehmigungen ────────────────────────────────────

function PendingApprovalsCard({ count }: { count: number }) {
  const allClear = count === 0

  return (
    <div
      className={cx(
        'flex flex-col justify-between rounded-xl border p-5',
        allClear
          ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
          : 'border-amber-500/25 bg-amber-500/[0.04]',
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Genehmigungen
          </p>
          {allClear ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400">
              ✓
            </span>
          ) : (
            <Badge tone="warning">{count}</Badge>
          )}
        </div>

        <p className="mt-3 text-base font-semibold text-white">
          {allClear ? 'Alles genehmigt' : 'Warten auf deine Freigabe'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {allClear
            ? 'Keine Delegations in der Warteschleife.'
            : `${count} Delegation${count === 1 ? '' : 'en'} brauchen eine Entscheidung.`}
        </p>
      </div>

      {!allClear && (
        <Link
          href="/delegations?filter=pending"
          className={cx(buttonClassName('secondary', 'mt-4 w-full justify-center text-sm'))}
        >
          Jetzt prüfen
        </Link>
      )}
    </div>
  )
}

// ─── Kachel 3: Aktive Ausführungen ──────────────────────────────────────────

function ActiveExecutionsCard({ running }: { running: Delegation[] }) {
  const count = running.length
  const preview = running.slice(0, 3)

  return (
    <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Aktive Ausführungen
          </p>
          {count > 0 && (
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
            </span>
          )}
        </div>

        {count === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Keine aktiven Ausführungen</p>
        ) : (
          <>
            <p className="mt-3 text-base font-semibold text-white">
              {count} Delegation{count === 1 ? '' : 'en'} laufen gerade
            </p>
            <ul className="mt-3 space-y-1.5">
              {preview.map(d => (
                <li key={d.id}>
                  <Link
                    href={`/delegations`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" aria-hidden="true" />
                    <span className="truncate">{d.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {count > 3 && (
        <Link
          href="/delegations?filter=running"
          className={cx(buttonClassName('ghost', 'mt-3 w-full justify-center text-xs'))}
        >
          Alle {count} anzeigen →
        </Link>
      )}
    </div>
  )
}

// ─── Kachel 4: Letzte Aktivität ─────────────────────────────────────────────

interface RecentEntry {
  id: string
  status: 'completed' | 'failed'
  title: string
  time: string
}

function RecentActivityCard({ entries }: { entries: Delegation[] }) {
  const items: RecentEntry[] = entries.map(d => ({
    id: d.id,
    status: d.status as 'completed' | 'failed',
    title: d.title,
    time: d.updatedAt ?? d.createdAt ?? '',
  }))

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Letzte Aktivität
        </p>
        <Link
          href="/delegations"
          className="text-xs text-violet-400 transition-colors hover:text-violet-300"
        >
          Alle anzeigen →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Noch keine abgeschlossenen Delegations.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/[0.05]">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <StatusDot
                tone={item.status === 'completed' ? 'success' : 'danger'}
              />
              <span className="flex-1 truncate text-sm text-slate-300">{item.title}</span>
              <span className="shrink-0 text-xs text-slate-600">
                {item.time ? relativeTime(item.time) : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Mini-Statistik ─────────────────────────────────────────────────────────

function MiniStats({ stats }: { stats: DashboardStats['delegations'] }) {
  const items = [
    { label: 'Gesamt', value: stats.total },
    { label: 'Abgeschlossen', value: stats.completed },
    { label: 'Fehler', value: stats.failed },
    { label: 'Laufend', value: stats.running },
  ]

  return (
    <div className="flex flex-wrap gap-6 px-1">
      {items.map(({ label, value }) => (
        <div key={label} className="text-center">
          <p className="text-lg font-semibold tabular-nums text-slate-400">{value}</p>
          <p className="text-xs text-slate-600">{label}</p>
        </div>
      ))}
    </div>
  )
}
