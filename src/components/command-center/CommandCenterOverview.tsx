'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, Clock, Play, ShieldCheck, Sparkles } from 'lucide-react'
import type { Delegation } from '@/lib/models/delegation'
import type { DashboardStats } from '@/app/api/dashboard/stats/route'
import { StatusDot, buttonClassName, cx } from '@/components/ui/primitives'

interface FocusedData {
  delegations: Delegation[]
  stats: DashboardStats | null
}

interface NextAction {
  eyebrow: string
  title: string
  detail: string
  href: string
  actionLabel: string
  tone: 'ready' | 'attention' | 'blocked'
}

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

function latestTime(delegation: Delegation): string {
  return delegation.updatedAt ?? delegation.createdAt ?? ''
}

export function CommandCenterOverview() {
  const [data, setData] = useState<FocusedData>({ delegations: [], stats: null })
  const [idea, setIdea] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [delegationsRes, statsRes] = await Promise.allSettled([
        fetch('/api/delegations').then(res => res.json() as Promise<Delegation[]>),
        fetch('/api/dashboard/stats').then(res => res.json() as Promise<DashboardStats>),
      ])

      if (cancelled) return

      setData({
        delegations:
          delegationsRes.status === 'fulfilled' && Array.isArray(delegationsRes.value)
            ? delegationsRes.value
            : [],
        stats: statsRes.status === 'fulfilled' ? statsRes.value : null,
      })
    }

    void load()
    const interval = window.setInterval(() => { void load() }, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const { delegations, stats } = data
  const failed = delegations.filter(d => d.status === 'failed')
  const pending = delegations.filter(d => d.status === 'pending')
  const approved = delegations.filter(d => d.status === 'approved')
  const running = delegations.filter(d => d.status === 'running')
  const finished = delegations
    .filter(d => d.status === 'completed' || d.status === 'failed')
    .sort((a, b) => latestTime(b).localeCompare(latestTime(a)))

  const nextAction = useMemo<NextAction>(() => {
    if (failed.length > 0) {
      return {
        eyebrow: 'Blocker',
        title: `${failed.length} Delegation${failed.length === 1 ? '' : 'en'} brauchen Review`,
        detail: 'Fehlerhafte Ausfuehrungen zuerst klaeren. Das stabilisiert den Kern-Flow, bevor neue Arbeit gestartet wird.',
        href: '/delegations?filter=failed',
        actionLabel: 'Fehler pruefen',
        tone: 'blocked',
      }
    }

    if (pending.length > 0) {
      return {
        eyebrow: 'Entscheidung',
        title: `${pending.length} Freigabe${pending.length === 1 ? '' : 'n'} wartet`,
        detail: 'Der schnellste Fortschritt entsteht jetzt durch klare Freigabe oder Ablehnung vorbereiteter Delegations.',
        href: '/delegations?filter=pending',
        actionLabel: 'Freigaben pruefen',
        tone: 'attention',
      }
    }

    if (approved.length > 0) {
      return {
        eyebrow: 'Startbereit',
        title: `${approved.length} Delegation${approved.length === 1 ? '' : 'en'} kann gestartet werden`,
        detail: 'Der Scope ist vorbereitet. Starte die naechste Aufgabe, solange Kontext und Akzeptanzkriterien frisch sind.',
        href: '/delegations?filter=approved',
        actionLabel: 'Queue oeffnen',
        tone: 'ready',
      }
    }

    return {
      eyebrow: 'Naechste Aktion',
      title: 'Neue Delegation aus einer klaren Idee erzeugen',
      detail: 'Fokus fuer V1: Idee strukturieren, Scope begrenzen, KI arbeiten lassen, kritisch pruefen, Wissen sichern.',
      href: '/delegations?new=1',
      actionLabel: 'Delegation starten',
      tone: 'ready',
    }
  }, [approved.length, failed.length, pending.length])

  const quickIdeaHref = idea.trim()
    ? `/idea?prompt=${encodeURIComponent(idea.trim())}`
    : '/idea'

  return (
    <div className="grid grid-cols-12 gap-5">
      <NextBestActionCard action={nextAction} />
      <ActiveDelegationsCard running={running} approved={approved} pending={pending} />
      <SystemHealthCard stats={stats} />
      <RecentReviewsCard stats={stats} finished={finished} />
      <QuickIdeaCard idea={idea} onIdeaChange={setIdea} href={quickIdeaHref} />
    </div>
  )
}

function NextBestActionCard({ action }: { action: NextAction }) {
  const tone = action.tone === 'blocked'
    ? 'border-rose-500/35 bg-rose-500/[0.05]'
    : action.tone === 'attention'
      ? 'border-amber-500/35 bg-amber-500/[0.05]'
      : 'border-emerald-500/25 bg-emerald-500/[0.04]'

  return (
    <section className={cx('col-span-12 lg:col-span-7 rounded-xl border p-7 shadow-sm shadow-black/20', tone)}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-emerald-300">
          <Play className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">{action.eyebrow}</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {action.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{action.detail}</p>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link
          href={action.href}
          className={buttonClassName(action.tone === 'blocked' ? 'destructive' : 'primary', 'min-h-11 flex-1')}
        >
          {action.actionLabel}
        </Link>
        <Link href="/projects" className={buttonClassName('secondary', 'min-h-11 flex-1')}>
          Projektkontext ansehen
        </Link>
      </div>
    </section>
  )
}

function ActiveDelegationsCard({
  running,
  approved,
  pending,
}: {
  running: Delegation[]
  approved: Delegation[]
  pending: Delegation[]
}) {
  const visible = [...running, ...approved, ...pending]
    .sort((a, b) => latestTime(b).localeCompare(latestTime(a)))
    .slice(0, 4)

  return (
    <section className="col-span-12 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-sm shadow-black/20 lg:col-span-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Aktive Delegations</h3>
        <span className="text-sm text-slate-500">{running.length} laufend</span>
      </div>

      <div className="mt-5 space-y-3">
        {visible.length > 0 ? visible.map(item => (
          <Link
            key={item.id}
            href="/delegations"
            className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{latestTime(item) ? relativeTime(latestTime(item)) : 'ohne Zeitstempel'}</p>
            </div>
            <StatusBadge status={item.status} />
          </Link>
        )) : (
          <div className="rounded-lg border border-dashed border-white/[0.08] p-5">
            <p className="text-sm font-medium text-white">Keine aktiven Delegations</p>
            <p className="mt-1 text-sm text-slate-500">Starte eine neue Delegation, sobald der naechste Scope klar ist.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: Delegation['status'] }) {
  const classes = {
    pending: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    approved: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    running: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
    completed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    failed: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    cancelled: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
  } satisfies Record<Delegation['status'], string>

  const icons = {
    pending: <AlertTriangle className="h-3.5 w-3.5" />,
    approved: <CheckCircle className="h-3.5 w-3.5" />,
    running: <Clock className="h-3.5 w-3.5" />,
    completed: <CheckCircle className="h-3.5 w-3.5" />,
    failed: <AlertTriangle className="h-3.5 w-3.5" />,
    cancelled: <AlertTriangle className="h-3.5 w-3.5" />,
  } satisfies Record<Delegation['status'], ReactNode>

  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', classes[status])}>
      {icons[status]}
      {status}
    </span>
  )
}

function SystemHealthCard({ stats }: { stats: DashboardStats | null }) {
  const activeProviders = stats?.system.activeProviders ?? 0
  const testsGreen = stats?.system.testsGreen ?? 0
  const aiCallsToday = stats?.system.aiCallsToday ?? 0

  return (
    <section className="col-span-12 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-sm shadow-black/20 lg:col-span-4">
      <h3 className="text-lg font-semibold text-white">System Health</h3>
      <div className="mt-5 space-y-4">
        <HealthLine label="AI Provider" value={activeProviders > 0 ? `${activeProviders} aktiv` : 'einrichten'} ok={activeProviders > 0} href="/settings/providers" />
        <HealthLine label="Tests" value={testsGreen > 0 ? `${testsGreen} gruen` : 'kein Lauf'} ok={testsGreen > 0} href="/analytics" />
        <HealthLine label="AI Calls heute" value={aiCallsToday} ok href="/governance" />
      </div>
    </section>
  )
}

function HealthLine({
  label,
  value,
  ok,
  href,
}: {
  label: string
  value: string | number
  ok: boolean
  href: string
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3 transition-colors hover:border-white/[0.14]">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium text-white">
        <StatusDot tone={ok ? 'success' : 'warning'} />
        {value}
      </span>
    </Link>
  )
}

function RecentReviewsCard({
  stats,
  finished,
}: {
  stats: DashboardStats | null
  finished: Delegation[]
}) {
  const avgScore = stats?.quality.avgScore
  const topWarning = stats?.quality.topWarning
  const latest = finished[0]
  const scoreTone = avgScore === null || avgScore === undefined
    ? 'text-slate-400'
    : avgScore >= 80
      ? 'text-emerald-300'
      : avgScore >= 60
        ? 'text-amber-300'
        : 'text-rose-300'

  return (
    <section className="col-span-12 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-sm shadow-black/20 lg:col-span-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Letzte Critic Reviews</h3>
        <Link href="/agents?tab=performance" className="text-sm text-slate-400 transition-colors hover:text-white">
          Details
        </Link>
      </div>

      <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/20 p-4">
        <div className="flex gap-4">
          <div className={cx('text-2xl font-semibold tabular-nums', scoreTone)}>
            {avgScore ?? '--'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">
              {latest ? `Delegation: ${latest.title}` : 'Noch keine abgeschlossene Delegation'}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {topWarning
                ? topWarning.message
                : latest
                  ? latest.status === 'failed' ? 'Review noetig: Ausfuehrung fehlgeschlagen.' : 'Letzter Lauf abgeschlossen. Score zeigt die aktuelle Review-Qualitaet.'
                  : 'Sobald Delegations abgeschlossen sind, erscheint hier die kritische Qualitaetslage.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function QuickIdeaCard({
  idea,
  onIdeaChange,
  href,
}: {
  idea: string
  onIdeaChange: (value: string) => void
  href: string
}) {
  return (
    <section className="col-span-12 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-sm shadow-black/20 lg:col-span-7">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-cyan-300">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Schnell eine neue Idee eingeben</h3>
          <p className="mt-1 text-sm text-slate-500">Aus einer Idee wird der naechste strukturierte Brief.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={idea}
          onChange={event => onIdeaChange(event.target.value)}
          placeholder="z.B. Dark Mode Toggle mit persistenter Einstellung..."
          className="min-h-11 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/50"
        />
        <Link href={href} className={buttonClassName('primary', 'min-h-11 px-6')}>
          Delegieren
        </Link>
      </div>
    </section>
  )
}

export function CommandCenterPrinciples() {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] px-4 py-3 text-xs text-cyan-100">
      <ShieldCheck className="mr-2 inline h-4 w-4 align-text-bottom text-cyan-300" />
      Fokus: naechste sinnvolle Aktion, klare Delegation, kritischer Review, kein ueberladenes Swarm-Dashboard.
    </div>
  )
}
