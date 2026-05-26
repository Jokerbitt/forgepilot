'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bot, CheckCircle2, ExternalLink, FileText, Rocket, ShieldCheck } from 'lucide-react'
import { Badge, Metric, Panel, buttonClassName, cx } from '@/components/ui/primitives'
import type { ProjectSummary } from '@/app/api/projects/route'

const statusTone: Record<ProjectSummary['status'], 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  intake: 'neutral',
  planning: 'warning',
  ready: 'success',
  in_progress: 'info',
  attention: 'danger',
  completed: 'success',
}

const statusLabel: Record<ProjectSummary['status'], string> = {
  intake: 'Intake',
  planning: 'Planung',
  ready: 'Bereit',
  in_progress: 'In Umsetzung',
  attention: 'Klärung',
  completed: 'Abschluss',
}

const delegationTone: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  approved: 'info',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  rejected: 'danger',
}

const targetPlatformLabel: Record<NonNullable<ProjectSummary['targetPlatform']>, string> = {
  webapp: 'Webapp',
  desktop: 'Desktop App',
  mobile: 'Mobile iOS & Android',
  cross_platform: 'Cross-platform',
  undecided: 'Empfehlung',
}

const persistenceLabel: Record<NonNullable<ProjectSummary['persistenceStrategy']>, string> = {
  recommend: 'DB Empfehlung',
  postgres: 'PostgreSQL',
  sqlite: 'SQLite',
  json_file: 'JSON-Dateien',
  supabase: 'Supabase',
  none: 'Keine DB',
}

const planningModeLabel: Record<NonNullable<ProjectSummary['planningMode']>, string> = {
  beginner: 'Anfänger Automatik',
  expert: 'Expertenmodus',
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [pmBusy, setPmBusy] = useState(false)
  const [pmMessage, setPmMessage] = useState<string | null>(null)

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' })
      const data = await res.json() as ProjectSummary[]
      if (Array.isArray(data)) setProjects(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects()
    const interval = setInterval(() => void loadProjects(), 15000)
    return () => clearInterval(interval)
  }, [])

  const project = useMemo(() => projects.find(item => item.id === projectId), [projectId, projects])

  const runProjectManagerBatch = async () => {
    if (!project) return
    setPmBusy(true)
    setPmMessage(null)
    let created = 0
    let started = 0
    let skipped = 0
    try {
      const safeSteps = project.pmPlan.nextSteps.filter(step => step.canAutoStart).slice(0, 2)
      for (const step of safeSteps) {
        if (step.action === 'create_delegation' && step.workPackageId) {
          const res = await fetch(`/api/work-packages/${step.workPackageId}/create-delegation`, { method: 'POST' })
          if (res.ok) created += 1
          else skipped += 1
        } else if (step.action === 'start_delegation' && step.delegationId) {
          const res = await fetch(`/api/delegations/${step.delegationId}/start`, { method: 'POST' })
          if (res.ok) started += 1
          else skipped += 1
        } else {
          skipped += 1
        }
      }
      setPmMessage(`Projektmanager ausgeführt: ${created} Feature-Delegation angelegt, ${started} gestartet${skipped ? `, ${skipped} übersprungen` : ''}.`)
      await loadProjects()
    } catch {
      setPmMessage('Projektmanager konnte den Batch nicht ausführen. Bitte prüfe die Feature-Delegations.')
    } finally {
      setPmBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08080d] p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <Panel className="h-80 animate-pulse p-6">
            <span className="sr-only">Lade Projekt...</span>
          </Panel>
        </div>
      </main>
    )
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-[#08080d] p-6 text-white">
        <div className="mx-auto max-w-3xl">
          <Panel className="p-8 text-center">
            <h1 className="text-xl font-semibold text-white">Projekt nicht gefunden</h1>
            <p className="mt-2 text-sm text-slate-500">Das Projekt existiert nicht mehr oder wurde gefiltert.</p>
            <Link href="/projects" className={buttonClassName('secondary', 'mt-5')}>Zurück zu Projekte</Link>
          </Panel>
        </div>
      </main>
    )
  }

  const safeSteps = project.pmPlan.nextSteps.filter(step => step.canAutoStart)

  return (
    <main className="min-h-screen bg-[#08080d] text-white">
      <div className="border-b border-white/[0.07] bg-[#0b0b11]/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/projects" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-300">
            <ArrowLeft className="h-4 w-4" />
            Projekte
          </Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone[project.status]}>{statusLabel[project.status]}</Badge>
                {project.pipeline && <Badge tone="privacy">Plan Mode</Badge>}
                <Badge tone={project.planningMode === 'expert' ? 'warning' : 'success'}>
                  {planningModeLabel[project.planningMode ?? 'beginner']}
                </Badge>
                <Badge tone="info">{targetPlatformLabel[project.targetPlatform ?? 'undecided']}</Badge>
                <Badge tone="privacy">{persistenceLabel[project.persistenceStrategy ?? 'recommend']}</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">{project.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{project.problemStatement || 'Noch kein Problem Statement gepflegt.'}</p>
              {project.platformGuidance && (
                <p className="mt-3 max-w-3xl rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-xs leading-5 text-sky-100/80">
                  {project.platformGuidance}
                </p>
              )}
              {project.persistenceGuidance && (
                <p className="mt-2 max-w-3xl rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs leading-5 text-emerald-100/80">
                  {project.persistenceGuidance}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link href={`/project-briefs/${project.id}`} className={buttonClassName('secondary')}>
                <FileText className="h-4 w-4" />
                Brief öffnen
              </Link>
              <Link href={`/delegations?new=1&briefId=${project.id}`} className={buttonClassName('primary')}>
                Feature delegieren
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <section className="space-y-5">
          <Panel className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Projektfortschritt</span>
              <span>{project.progress.completed}/{project.progress.total} erledigt · {project.progress.pct}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cx('h-full rounded-full', project.status === 'attention' ? 'bg-rose-400' : project.status === 'in_progress' ? 'bg-violet-400' : 'bg-emerald-400')}
                style={{ width: `${Math.min(project.progress.pct, 100)}%` }}
              />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric label="Meilensteine" value={project.metrics.milestones} detail="Projektstruktur" tone="info" />
              <Metric label="Arbeitspakete" value={project.metrics.workPackages} detail="Planbare Features" tone="info" />
              <Metric label="Feature-Delegations" value={project.metrics.delegations} detail="Umsetzung" tone="privacy" />
              <Metric label="Aktive Agenten" value={project.activeAgents.length} detail="arbeiten gerade" tone={project.activeAgents.length > 0 ? 'success' : 'neutral'} />
            </div>
            <div className="mt-4 grid gap-3 rounded-xl border border-white/[0.07] bg-slate-950 px-4 py-3 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Planungsmodus</span>
                <span className="mt-1 block text-sm font-semibold text-white">{planningModeLabel[project.planningMode ?? 'beginner']}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {project.planningMode === 'expert'
                    ? 'Die Architektur wurde bewusst durch Nutzer- oder Expertenvorgaben geprägt.'
                    : 'ForgePilot hat Produktform und Datenhaltung automatisch gewählt und begründet.'}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Produktform</span>
                  <span className="mt-1 block text-sm font-semibold text-white">{targetPlatformLabel[project.targetPlatform ?? 'undecided']}</span>
                </span>
                <Link href={`/idea?prompt=${encodeURIComponent(`Prüfe für "${project.title}", ob ${targetPlatformLabel[project.targetPlatform ?? 'undecided']} wirklich die beste Produktform ist und gib eine klare Empfehlung.`)}`} className="text-xs font-semibold text-violet-300 hover:text-violet-200">
                  Produktform neu bewerten →
                </Link>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Datenhaltung</span>
                  <span className="mt-1 block text-sm font-semibold text-white">{persistenceLabel[project.persistenceStrategy ?? 'recommend']}</span>
                </span>
                <Link href={`/idea?prompt=${encodeURIComponent(`Prüfe für "${project.title}", ob ${persistenceLabel[project.persistenceStrategy ?? 'recommend']} als Datenhaltung sinnvoll ist. Vergleiche Postgres, SQLite, JSON-Dateien und Supabase.`)}`} className="text-xs font-semibold text-sky-300 hover:text-sky-200">
                  Datenhaltung neu bewerten →
                </Link>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feature-Delegations</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Was wird in diesem Projekt umgesetzt?</h2>
              </div>
              <Link href={`/delegations?briefId=${project.id}`} className={buttonClassName('secondary')}>
                Alle anzeigen
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            {project.activeAgents.length > 0 && (
              <div className="mt-5 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-violet-100">
                  <Bot className="h-4 w-4" />
                  Aktive KI-Agenten
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {project.activeAgents.map(agent => (
                    <DelegationRow key={agent.id} item={agent} compact />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.07]">
              {project.recentDelegations.length === 0 ? (
                <div className="p-6">
                  <p className="text-sm font-semibold text-white">Noch keine Feature-Delegation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Lege aus diesem Projekt die erste Feature-Delegation an, sobald der Plan klar ist.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {project.recentDelegations.map(item => <DelegationRow key={item.id} item={item} />)}
                </div>
              )}
            </div>
          </Panel>
        </section>

        <aside className="space-y-5">
          <Panel className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">KI Projektmanager</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Nächste sinnvolle Schritte</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{project.pmPlan.summary}</p>
            <button
              type="button"
              onClick={() => void runProjectManagerBatch()}
              disabled={pmBusy || safeSteps.length === 0}
              className={cx(buttonClassName('primary', 'mt-4 w-full'), 'disabled:cursor-not-allowed disabled:opacity-45')}
            >
              <Rocket className="h-4 w-4" />
              {pmBusy ? 'PM startet Batch...' : 'Sicheren Batch starten'}
            </button>
            {pmMessage && (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-200">
                {pmMessage}
              </div>
            )}
            <div className="mt-4 space-y-2">
              {project.pmPlan.nextSteps.map((step, index) => (
                <Link key={step.id} href={step.href} className="block rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 transition hover:border-violet-500/30 hover:bg-violet-500/[0.04]">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-slate-950 text-xs font-bold text-slate-300">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{step.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{step.reason}</span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        {step.riskClass && <Badge tone={step.riskClass === 'C' ? 'danger' : step.riskClass === 'B' ? 'warning' : 'success'}>Risk {step.riskClass}</Badge>}
                        <Badge tone={step.canAutoStart ? 'success' : 'neutral'}>{pmActionLabel(step.action)}</Badge>
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projektqualität</p>
            <div className="mt-4 space-y-3">
              <QualityLine label="Requirements" value={project.metrics.acceptedRequirements} good={project.metrics.acceptedRequirements > 0} />
              <QualityLine label="Offene Risiken" value={project.metrics.openRisks} good={project.metrics.openRisks === 0} />
              <QualityLine label="Blockierte Pakete" value={project.metrics.blockedWorkPackages} good={project.metrics.blockedWorkPackages === 0} />
              <QualityLine label="Fehlgeschlagene Delegations" value={project.progress.failed} good={project.progress.failed === 0} />
            </div>
          </Panel>

          {project.pipeline && (
            <Panel className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan Mode Ursprung</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{project.pipeline.idea}</p>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/[0.07] bg-slate-950 px-3 py-2">
                <span className="text-xs text-slate-500">Run Status</span>
                <Badge tone={project.pipeline.runStatus === 'done' ? 'success' : project.pipeline.runStatus === 'failed' ? 'danger' : 'info'}>{project.pipeline.runStatus}</Badge>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </main>
  )
}

function DelegationRow({
  item,
  compact = false,
}: {
  item: ProjectSummary['recentDelegations'][number]
  compact?: boolean
}) {
  return (
    <Link
      href={item.href}
      className={cx(
        'grid gap-3 p-4 transition hover:bg-white/[0.025]',
        compact ? 'rounded-lg border border-violet-500/15 bg-slate-950/70' : 'md:grid-cols-[minmax(0,1fr)_120px_110px_120px] md:items-center',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
        <p className="mt-1 text-xs text-slate-500">Aktualisiert {new Date(item.updatedAt).toLocaleString('de-DE')}</p>
      </div>
      {!compact && <span className="text-xs font-medium text-slate-400">{item.agent}</span>}
      {!compact && <span className="text-xs text-slate-500">{item.route}</span>}
      <Badge tone={delegationTone[item.status] ?? 'neutral'}>{item.status}</Badge>
    </Link>
  )
}

function QualityLine({ label, value, good }: { label: string; value: number; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-slate-950 px-3 py-2.5">
      <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <CheckCircle2 className={cx('h-3.5 w-3.5', good ? 'text-emerald-300' : 'text-amber-300')} />
        {label}
      </span>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  )
}

function pmActionLabel(action: ProjectSummary['pmPlan']['nextSteps'][number]['action']): string {
  if (action === 'fix_failed') return 'Fehler prüfen'
  if (action === 'monitor_running') return 'Beobachten'
  if (action === 'start_delegation') return 'Startbereit'
  if (action === 'create_delegation') return 'Anlegen'
  if (action === 'clarify_risk') return 'Klären'
  return 'Planen'
}
