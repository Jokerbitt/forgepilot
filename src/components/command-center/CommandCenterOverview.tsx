'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Bot, CheckCircle, Clipboard, Clock, FileText, Play, ShieldCheck, Sparkles } from 'lucide-react'
import type { Delegation } from '@/lib/models/delegation'
import type { DashboardStats } from '@/app/api/dashboard/stats/route'
import type { DailyReport } from '@/lib/reports/daily-report'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { Gbot4HandoffPackage } from '@/app/api/reports/daily/gbot4-handoff/route'
import type { Gbot4FeedbackBody, Gbot4Verdict } from '@/app/api/reports/daily/gbot4-feedback/route'
import { StatusDot, buttonClassName, cx } from '@/components/ui/primitives'

interface FocusedData {
  delegations: Delegation[]
  stats: DashboardStats | null
  report: DailyReport | null
  acceptedBriefs: ProjectBrief[]
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
  const [data, setData] = useState<FocusedData>({ delegations: [], stats: null, report: null, acceptedBriefs: [] })
  const [idea, setIdea] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [delegationsRes, statsRes, reportRes, acceptedBriefsRes] = await Promise.allSettled([
        fetch('/api/delegations').then(res => res.json() as Promise<Delegation[]>),
        fetch('/api/dashboard/stats').then(res => res.json() as Promise<DashboardStats>),
        fetch('/api/reports/daily').then(res => res.json() as Promise<DailyReport>),
        fetch('/api/project-briefs?status=accepted').then(res => res.json() as Promise<ProjectBrief[]>),
      ])

      if (cancelled) return

      setData({
        delegations:
          delegationsRes.status === 'fulfilled' && Array.isArray(delegationsRes.value)
            ? delegationsRes.value
            : [],
        stats: statsRes.status === 'fulfilled' ? statsRes.value : null,
        report: reportRes.status === 'fulfilled' && reportRes.value.version === 1
          ? reportRes.value
          : null,
        acceptedBriefs:
          acceptedBriefsRes.status === 'fulfilled' && Array.isArray(acceptedBriefsRes.value)
            ? acceptedBriefsRes.value
            : [],
      })
    }

    void load()
    const interval = window.setInterval(() => { void load() }, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const { delegations, stats, report, acceptedBriefs } = data
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
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <NextBestActionCard action={nextAction} />
      <ActiveDelegationsCard running={running} approved={approved} pending={pending} acceptedBriefs={acceptedBriefs} />
      <SystemHealthCard stats={stats} />
      <DailyCriticReportCard report={report} stats={stats} finished={finished} />
      <GrokHandoffCard />
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
  acceptedBriefs,
}: {
  running: Delegation[]
  approved: Delegation[]
  pending: Delegation[]
  acceptedBriefs: ProjectBrief[]
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

      {/* Accepted Briefs — ready to delegate */}
      {acceptedBriefs.length > 0 && (
        <div className="mt-3 border-t border-gray-800 pt-3">
          <p className="text-xs text-gray-500 mb-2">Bereit zur Delegation:</p>
          {acceptedBriefs.slice(0, 2).map(brief => (
            <Link
              key={brief.id}
              href={`/delegations?briefId=${brief.id}&new=1`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 group"
            >
              <span className="text-xs text-gray-300 truncate">{brief.title}</span>
              <span className="text-xs text-violet-400 group-hover:text-violet-300">&#x2192;</span>
            </Link>
          ))}
        </div>
      )}
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

function DailyCriticReportCard({
  report,
  stats,
  finished,
}: {
  report: DailyReport | null
  stats: DashboardStats | null
  finished: Delegation[]
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const avgScore = stats?.quality.avgScore
  const topWarning = stats?.quality.topWarning
  const latest = finished[0]
  const headlineValue = latest && avgScore !== null && avgScore !== undefined
    ? avgScore
    : report
      ? report.risks.length
      : '--'
  const headlineLabel = latest ? 'Critic Score' : 'Risiken'
  const headlineTone = latest && avgScore !== null && avgScore !== undefined
    ? avgScore >= 80
      ? 'text-emerald-300'
      : avgScore >= 60
        ? 'text-amber-300'
        : 'text-rose-300'
    : report?.executiveVerdict.status === 'red'
      ? 'text-rose-300'
      : report?.executiveVerdict.status === 'yellow'
        ? 'text-amber-300'
        : 'text-emerald-300'

  const verdictTone = report?.executiveVerdict.status === 'red'
    ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
    : report?.executiveVerdict.status === 'yellow'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
  const loopStep = report?.firstRealValueLoop.currentStep

  async function copyMarkdown() {
    if (!report?.markdown) return
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(report.markdown)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = report.markdown
        textArea.setAttribute('readonly', 'true')
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textArea)
        if (!copied) throw new Error('copy command failed')
      }
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      try {
        const textArea = document.createElement('textarea')
        textArea.value = report.markdown
        textArea.setAttribute('readonly', 'true')
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopyState(copied ? 'copied' : 'failed')
      } catch {
        setCopyState('failed')
      }
      window.setTimeout(() => setCopyState('idle'), 2400)
    }
  }

  return (
    <section className="col-span-12 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-sm shadow-black/20 lg:col-span-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Assistant Daily Report</h3>
          <p className="mt-1 text-xs text-slate-500">LLM-neutraler Handoff ohne Secrets.</p>
        </div>
        <span className={cx('rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide', verdictTone)}>
          {report?.executiveVerdict.status ?? 'loading'}
        </span>
      </div>

      <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/20 p-4">
        <div className="flex gap-4">
          <div className={cx('min-w-12 text-2xl font-semibold tabular-nums', headlineTone)}>
            {headlineValue}
            <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{headlineLabel}</div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">
              {latest ? `Delegation: ${latest.title}` : 'Report: MVP-Risiken und naechste Aufgaben'}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {topWarning
                ? topWarning.message
                : latest
                  ? latest.status === 'failed' ? 'Review noetig: Ausfuehrung fehlgeschlagen.' : 'Letzter Lauf abgeschlossen. Score zeigt die aktuelle Review-Qualitaet.'
                  : report?.risks[0]?.title ?? 'Sobald Daten vorhanden sind, erscheint hier die kritische Qualitaetslage.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-4">
        <p className="text-sm font-medium text-white">
          {report ? report.executiveVerdict.summary : 'Daily Report wird geladen...'}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MetricPill label="Risiken" value={report?.risks.length ?? '--'} />
          <MetricPill label="Actions" value={report?.nextActions.length ?? '--'} />
          <MetricPill label="Coverage" value={report ? `${report.status.quality.criticCoveragePct}%` : '--'} />
        </div>
      </div>

      {report?.firstRealValueLoop && (
        <div className="mt-4 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                First Real Value Loop
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {report.firstRealValueLoop.currentStep.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {report.firstRealValueLoop.currentStep.action}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-lg font-semibold tabular-nums text-emerald-300">
                {report.firstRealValueLoop.progressPct}%
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Loop</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${report.firstRealValueLoop.progressPct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {report.firstRealValueLoop.steps.map(step => (
              <Link
                key={step.id}
                href={step.href}
                className={cx(
                  'rounded-md border px-2 py-1.5 text-[10px] font-medium transition-colors',
                  step.status === 'done'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                    : step.status === 'blocked'
                      ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
                      : step.status === 'active'
                        ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100'
                        : 'border-white/[0.06] bg-white/[0.02] text-slate-500',
                )}
              >
                {step.label}
              </Link>
            ))}
          </div>
          {loopStep && (
            <Link
              href={loopStep.href}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-300/35 hover:bg-emerald-400/15"
            >
              Naechste Aktion oeffnen
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={copyMarkdown}
          disabled={!report}
          className={buttonClassName('primary', 'min-h-10 flex-1 disabled:pointer-events-none disabled:opacity-50')}
        >
          <Clipboard className="h-4 w-4" />
          {copyState === 'copied' ? 'Kopiert' : copyState === 'failed' ? 'Manuell kopieren' : 'Fuer LLM kopieren'}
        </button>
        <a
          href="/api/reports/daily?format=markdown"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName('secondary', 'min-h-10 flex-1')}
        >
          <FileText className="h-4 w-4" />
          Markdown
        </a>
      </div>
      {copyState === 'failed' && report?.markdown && (
        <textarea
          readOnly
          value={report.markdown}
          onFocus={event => event.currentTarget.select()}
          className="mt-3 h-28 w-full rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-3 py-2 font-mono text-xs leading-5 text-amber-50 outline-none"
          aria-label="Daily Report Markdown manuell kopieren"
        />
      )}
    </section>
  )
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <div className="text-sm font-semibold tabular-nums text-white">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
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

type HandoffState = 'idle' | 'loading' | 'ready' | 'error'
type FeedbackSaveState = 'idle' | 'saving' | 'saved' | 'error'

function parseFeedbackJson(raw: string): Gbot4FeedbackBody | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const verdicts: Gbot4Verdict[] = ['approved', 'needs_attention', 'critical']
    if (!verdicts.includes(parsed.verdict as Gbot4Verdict)) return null
    if (typeof parsed.score !== 'number') return null
    if (!Array.isArray(parsed.risks)) return null
    if (typeof parsed.recommendation !== 'string') return null
    if (typeof parsed.linearComment !== 'string') return null
    return parsed as unknown as Gbot4FeedbackBody
  } catch {
    return null
  }
}

function GrokHandoffCard() {
  const [handoffState, setHandoffState] = useState<HandoffState>('idle')
  const [handoff, setHandoff] = useState<Gbot4HandoffPackage | null>(null)
  const [copyPromptState, setCopyPromptState] = useState<'idle' | 'copied'>('idle')
  const [copyReportState, setCopyReportState] = useState<'idle' | 'copied'>('idle')
  const [feedbackRaw, setFeedbackRaw] = useState('')
  const [feedbackSaveState, setFeedbackSaveState] = useState<FeedbackSaveState>('idle')
  const [feedbackError, setFeedbackError] = useState('')
  const [expanded, setExpanded] = useState(false)

  async function loadHandoff() {
    setHandoffState('loading')
    try {
      const res = await fetch('/api/reports/daily/gbot4-handoff')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as Gbot4HandoffPackage
      setHandoff(data)
      setHandoffState('ready')
      setExpanded(true)
    } catch {
      setHandoffState('error')
    }
  }

  async function copyText(text: string, setCopyState: (s: 'idle' | 'copied') => void) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      // silently ignore
    }
  }

  async function saveFeedback() {
    if (!feedbackRaw.trim()) return
    const parsed = parseFeedbackJson(feedbackRaw.trim())
    if (!parsed) {
      setFeedbackError('Ungueltig: JSON muss verdict, score (1-10), risks (Array), recommendation und linearComment enthalten.')
      return
    }
    setFeedbackError('')
    setFeedbackSaveState('saving')
    try {
      const res = await fetch('/api/reports/daily/gbot4-feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setFeedbackSaveState('saved')
      setFeedbackRaw('')
      window.setTimeout(() => setFeedbackSaveState('idle'), 2500)
    } catch {
      setFeedbackSaveState('error')
    }
  }

  return (
    <section className="col-span-12 rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-6 shadow-sm shadow-black/20 lg:col-span-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-300">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Grok Critic Handoff</h3>
            <p className="mt-0.5 text-xs text-slate-500">Sicherer Handoff — keine Secrets, keine Tokens.</p>
          </div>
        </div>
        {handoffState === 'idle' && (
          <button
            type="button"
            onClick={() => { void loadHandoff() }}
            className={buttonClassName('primary', 'min-h-9 text-sm')}
          >
            Paket erstellen
          </button>
        )}
        {handoffState === 'loading' && (
          <span className="text-sm text-slate-500">Lade...</span>
        )}
        {handoffState === 'error' && (
          <button type="button" onClick={() => { void loadHandoff() }} className={buttonClassName('destructive', 'min-h-9 text-sm')}>
            Erneut versuchen
          </button>
        )}
        {handoffState === 'ready' && (
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            className={buttonClassName('secondary', 'min-h-9 text-sm')}
          >
            {expanded ? 'Minimieren' : 'Anzeigen'}
          </button>
        )}
      </div>

      {handoffState === 'idle' && (
        <div className="mt-4 rounded-lg border border-dashed border-violet-500/20 p-4 text-center">
          <p className="text-sm text-slate-500">
            Erstelle ein Handoff-Paket um den Report + Prompt fuer Grok zu kopieren und Feedback zurueck zu importieren.
          </p>
        </div>
      )}

      {handoffState === 'ready' && handoff && expanded && (
        <div className="mt-4 space-y-4">
          {/* Context summary */}
          <div className="grid grid-cols-2 gap-2">
            <MetricPill label="Aktive Delegations" value={handoff.safeContext.activeDelegations} />
            <MetricPill label="Offene Approvals" value={handoff.safeContext.pendingApprovals} />
          </div>

          {/* Copy actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => { void copyText(handoff.promptTemplate, setCopyPromptState) }}
              className={buttonClassName('primary', 'min-h-10 flex-1 text-sm')}
            >
              <Clipboard className="h-4 w-4" />
              {copyPromptState === 'copied' ? 'Prompt kopiert!' : 'Prompt kopieren'}
            </button>
            <button
              type="button"
              onClick={() => { void copyText(handoff.reportMarkdown, setCopyReportState) }}
              className={buttonClassName('secondary', 'min-h-10 flex-1 text-sm')}
            >
              <FileText className="h-4 w-4" />
              {copyReportState === 'copied' ? 'Report kopiert!' : 'Report kopieren'}
            </button>
          </div>

          {/* Instructions */}
          <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-3">
            <p className="text-xs font-medium text-violet-300 mb-1">Workflow</p>
            <pre className="text-xs leading-5 text-slate-400 whitespace-pre-wrap">{handoff.instructions}</pre>
          </div>

          {/* Feedback import */}
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-4">
            <p className="mb-2 text-sm font-medium text-white">Grok Feedback einfuegen</p>
            <textarea
              value={feedbackRaw}
              onChange={e => setFeedbackRaw(e.target.value)}
              placeholder={'{\n  "verdict": "approved",\n  "score": 8,\n  "risks": ["..."],\n  "recommendation": "...",\n  "linearComment": "..."\n}'}
              rows={6}
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-400/50"
              aria-label="Grok Feedback JSON einfuegen"
            />
            {feedbackError && (
              <p className="mt-1.5 text-xs text-rose-400">{feedbackError}</p>
            )}
            <button
              type="button"
              onClick={() => { void saveFeedback() }}
              disabled={!feedbackRaw.trim() || feedbackSaveState === 'saving'}
              className={buttonClassName('primary', 'mt-3 min-h-9 w-full text-sm disabled:pointer-events-none disabled:opacity-50')}
            >
              {feedbackSaveState === 'saving'
                ? 'Speichern...'
                : feedbackSaveState === 'saved'
                  ? 'Gespeichert!'
                  : feedbackSaveState === 'error'
                    ? 'Fehler — erneut versuchen'
                    : 'Feedback speichern'}
            </button>
          </div>
        </div>
      )}
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
