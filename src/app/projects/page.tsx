'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Bot, CheckCircle2, CircleDot, FileText, GitBranch, ListChecks, PlayCircle, Rocket, Search, ShieldCheck } from 'lucide-react'
import { Badge, Panel, StatusDot, buttonClassName, cx } from '@/components/ui/primitives'
import type { ProjectSummary } from '@/app/api/projects/route'

type ProjectStatus = ProjectSummary['status']

const statusMeta: Record<ProjectStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; description: string }> = {
  intake: { label: 'Intake', tone: 'neutral', description: 'Idee ist erfasst, muss aber noch in Anforderungen uebersetzt werden.' },
  planning: { label: 'Planung', tone: 'warning', description: 'Der Plan entsteht. Arbeitspakete sind der naechste Engpass.' },
  ready: { label: 'Bereit', tone: 'success', description: 'Der Plan ist konkret genug, um kontrolliert delegiert zu werden.' },
  in_progress: { label: 'In Umsetzung', tone: 'info', description: 'Agenten oder manuelle Aufgaben arbeiten bereits am Projekt.' },
  attention: { label: 'Klaerung', tone: 'danger', description: 'Blocker oder Fehler muessen zuerst geloest werden.' },
  completed: { label: 'Abschluss', tone: 'success', description: 'Review und Writeback stehen im Fokus.' },
}

const pathSteps: Array<{ key: keyof ProjectSummary['metrics']; label: string; description: string }> = [
  { key: 'acceptedRequirements', label: 'Requirements', description: 'Was muss wirklich gebaut werden?' },
  { key: 'milestones', label: 'Meilensteine', description: 'In welcher Reihenfolge entsteht Wert?' },
  { key: 'workPackages', label: 'Arbeitspakete', description: 'Was koennen Agenten picken?' },
  { key: 'delegations', label: 'Delegation', description: 'Wer arbeitet woran?' },
]

const filterOptions: Array<{ value: 'all' | ProjectStatus; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'attention', label: 'Klaerung' },
  { value: 'in_progress', label: 'Aktiv' },
  { value: 'ready', label: 'Bereit' },
  { value: 'planning', label: 'Planung' },
  { value: 'intake', label: 'Intake' },
  { value: 'completed', label: 'Abschluss' },
]

const delegationStatusTone: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
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
  desktop: 'Desktop',
  mobile: 'Mobile iOS & Android',
  cross_platform: 'Cross-platform',
  undecided: 'Empfehlung',
}

const persistenceLabel: Record<NonNullable<ProjectSummary['persistenceStrategy']>, string> = {
  recommend: 'DB Empfehlung',
  postgres: 'Postgres',
  sqlite: 'SQLite',
  json_file: 'JSON',
  supabase: 'Supabase',
  none: 'Keine DB',
}

const planningModeLabel: Record<NonNullable<ProjectSummary['planningMode']>, string> = {
  beginner: 'Automatik',
  expert: 'Experte',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all')
  const [onlyActiveAgents, setOnlyActiveAgents] = useState(false)
  const [pmBusy, setPmBusy] = useState(false)
  const [pmMessage, setPmMessage] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadProjects = useCallback(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const nextProjects = data as ProjectSummary[]
          setProjects(nextProjects)
          setSelectedId(current => current ?? nextProjects[0]?.id ?? null)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const hasActive = projects.some(project => project.status === 'in_progress' || project.pipeline?.runStatus === 'running')
    pollRef.current = setInterval(loadProjects, hasActive ? 5000 : 20000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [projects, loadProjects])

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return projects.filter(project => {
      if (statusFilter !== 'all' && project.status !== statusFilter) return false
      if (onlyActiveAgents && project.activeAgents.length === 0) return false
      if (!normalizedQuery) return true
      return [
        project.title,
        project.problemStatement,
        project.pipeline?.idea ?? '',
        ...project.recentDelegations.map(delegation => delegation.title),
      ].some(value => value.toLowerCase().includes(normalizedQuery))
    })
  }, [onlyActiveAgents, projects, query, statusFilter])

  const selectedProject = useMemo(
    () => filteredProjects.find(project => project.id === selectedId) ?? filteredProjects[0] ?? projects.find(project => project.id === selectedId) ?? projects[0],
    [filteredProjects, projects, selectedId],
  )
  const portfolio = useMemo(() => ({
    total: projects.length,
    ready: projects.filter(project => project.status === 'ready').length,
    active: projects.filter(project => project.status === 'in_progress').length,
    attention: projects.filter(project => project.status === 'attention').length,
    agents: projects.reduce((sum, project) => sum + project.activeAgents.length, 0),
  }), [projects])

  const runProjectManagerBatch = async (project: ProjectSummary) => {
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
      setPmMessage(`Projektmanager ausgeführt: ${created} Delegation angelegt, ${started} gestartet${skipped ? `, ${skipped} übersprungen` : ''}.`)
      loadProjects()
    } catch {
      setPmMessage('Projektmanager konnte den Batch nicht ausführen. Prüfe die Delegations und versuche es erneut.')
    } finally {
      setPmBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#08080d] text-white">
      <div className="border-b border-white/[0.07] bg-[#0b0b11]/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/" className="transition-colors hover:text-slate-300">Command Center</Link>
              <span>/</span>
              <span className="text-slate-300">Projects</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Projekt Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Projekte stehen im Mittelpunkt. Öffne ein Projekt, sieh den Fortschritt und steuere die passenden Feature-Delegations darin.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/project-briefs" className={buttonClassName('secondary')}>Briefs pruefen</Link>
            <Link href="/idea" className={buttonClassName('primary')}>Neue Idee</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-5">
          <Panel className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portfolio</p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <PortfolioMetric label="Gesamt" value={portfolio.total} tone="neutral" />
              <PortfolioMetric label="Bereit" value={portfolio.ready} tone="success" />
              <PortfolioMetric label="Aktiv" value={portfolio.active} tone="info" />
              <PortfolioMetric label="Agenten" value={portfolio.agents} tone="info" />
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="space-y-3 border-b border-white/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projekte</p>
                <span className="text-xs text-slate-500">{filteredProjects.length}/{projects.length}</span>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-slate-950 px-3 py-2">
                <Search className="h-4 w-4 text-slate-600" aria-hidden="true" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Projekt suchen..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={cx(
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      statusFilter === option.value
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                        : 'border-white/[0.07] bg-white/[0.025] text-slate-500 hover:text-slate-300',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
                <span>Nur Projekte mit aktiven Agenten</span>
                <input
                  type="checkbox"
                  checked={onlyActiveAgents}
                  onChange={event => setOnlyActiveAgents(event.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
              </label>
            </div>
            {loading ? (
              <div className="space-y-3 p-4">{[0, 1, 2].map(item => <div key={item} className="h-20 rounded-lg border border-white/[0.06] bg-white/[0.03]" />)}</div>
            ) : projects.length === 0 ? (
              <div className="p-5">
                <p className="text-sm font-semibold text-white">Noch kein Projekt angelegt</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Starte mit einer Idee, damit ForgePilot daraus einen steuerbaren Plan macht.</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-5">
                <p className="text-sm font-semibold text-white">Kein Treffer</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Passe Filter oder Suche an, um weitere Projekte zu sehen.</p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-2">
                {filteredProjects.map(project => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedId(project.id)}
                    className={cx('mb-2 w-full rounded-lg border p-3 text-left transition-colors', selectedProject?.id === project.id ? 'border-violet-500/40 bg-violet-500/10' : 'border-transparent bg-transparent hover:border-white/[0.08] hover:bg-white/[0.04]')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="min-w-0 truncate text-sm font-semibold text-white">{project.title}</h2>
                      <StatusDot tone={statusMeta[project.status].tone} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{project.problemStatement || 'Kein Problem Statement gepflegt.'}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{project.progress.pct}% · {project.metrics.delegations} Feature-Delegations</span>
                      <span className="flex items-center gap-1.5">
                        <Badge tone={project.planningMode === 'expert' ? 'warning' : 'success'}>{planningModeLabel[project.planningMode ?? 'beginner']}</Badge>
                        <Badge tone="privacy">{targetPlatformLabel[project.targetPlatform ?? 'undecided']}</Badge>
                        <Badge tone="info">{persistenceLabel[project.persistenceStrategy ?? 'recommend']}</Badge>
                        <Badge tone={statusMeta[project.status].tone}>{statusMeta[project.status].label}</Badge>
                      </span>
                    </div>
                    {project.activeAgents.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-violet-300">
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                        {project.activeAgents.length} Agent aktiv
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </aside>

        <section className="min-w-0">
          {selectedProject ? <ProjectBlueprint project={selectedProject} onRunProjectManager={() => void runProjectManagerBatch(selectedProject)} pmBusy={pmBusy} pmMessage={pmMessage} /> : (
            <Panel className="flex min-h-[420px] items-center justify-center p-8 text-center">
              <div>
                <h2 className="text-lg font-semibold text-white">Warte auf Projekte</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Sobald ein Brief existiert, wird hier der Planungszustand sichtbar.</p>
              </div>
            </Panel>
          )}
        </section>
      </div>
    </main>
  )
}

function ProjectBlueprint({
  project,
  onRunProjectManager,
  pmBusy,
  pmMessage,
}: {
  project: ProjectSummary
  onRunProjectManager: () => void
  pmBusy: boolean
  pmMessage: string | null
}) {
  const meta = statusMeta[project.status]
  const progress = pathSteps.filter(step => Number(project.metrics[step.key]) > 0).length
  const qualitySignals = [
    { label: 'Offene Risiken', value: project.metrics.openRisks, tone: project.metrics.openRisks > 0 ? 'warning' : 'success', detail: project.metrics.openRisks > 0 ? 'Vor Delegation klaeren' : 'Keine offenen Risikosignale' },
    { label: 'Bereite Pakete', value: project.metrics.readyWorkPackages, tone: project.metrics.readyWorkPackages > 0 ? 'success' : 'neutral', detail: 'Agenten koennen diese Aufgaben picken' },
    { label: 'Blockierte Pakete', value: project.metrics.blockedWorkPackages, tone: project.metrics.blockedWorkPackages > 0 ? 'danger' : 'success', detail: project.metrics.blockedWorkPackages > 0 ? 'Blocker zuerst bearbeiten' : 'Keine Paketblocker' },
  ] as const

  return (
    <div className="space-y-5">
      <Panel className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              {project.pipeline && <Badge tone="privacy">Idea Pipeline</Badge>}
              <Badge tone={project.planningMode === 'expert' ? 'warning' : 'success'}>{planningModeLabel[project.planningMode ?? 'beginner']}</Badge>
              <Badge tone="info">{targetPlatformLabel[project.targetPlatform ?? 'undecided']}</Badge>
              <Badge tone="privacy">{persistenceLabel[project.persistenceStrategy ?? 'recommend']}</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">{project.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{project.problemStatement || meta.description}</p>
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
            <div className="mt-5 max-w-xl">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Projektfortschritt</span>
                <span>{project.progress.completed}/{project.progress.total} erledigt · {project.progress.pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cx('h-full rounded-full', project.status === 'attention' ? 'bg-rose-400' : project.status === 'in_progress' ? 'bg-violet-400' : 'bg-emerald-400')}
                  style={{ width: `${Math.min(project.progress.pct, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Link href={`/projects/${project.id}`} className={buttonClassName('secondary', 'shrink-0')}>
              Projekt öffnen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href={project.nextAction.href} className={buttonClassName(project.nextAction.tone === 'danger' ? 'destructive' : 'primary', 'shrink-0')}>
              {project.nextAction.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projektstruktur</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Vom Projekt zur Umsetzung</h3>
          </div>
          <span className="text-sm font-medium text-slate-400">{progress}/{pathSteps.length} Ebenen aktiv</span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {pathSteps.map((step, index) => {
            const value = Number(project.metrics[step.key])
            const active = value > 0
            return (
              <div key={step.key} className={cx('rounded-lg border p-4', active ? 'border-violet-500/25 bg-violet-500/[0.06]' : 'border-white/[0.07] bg-white/[0.02]')}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-slate-950 text-xs font-semibold text-slate-300">{index + 1}</span>
                  {active ? <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" /> : <CircleDot className="h-4 w-4 text-slate-600" aria-hidden="true" />}
                </div>
                <p className="mt-4 text-sm font-semibold text-white">{step.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</p>
                <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{step.description}</p>
              </div>
            )
          })}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planungsqualitaet</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {qualitySignals.map(signal => (
              <div key={signal.label} className="rounded-lg border border-white/[0.07] bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{signal.label}</p>
                  <Badge tone={signal.tone}>{signal.value}</Badge>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{signal.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">Autonomie-Grenze</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Agenten duerfen parallel arbeiten, wenn Arbeitspaket, Write Scope, Risiko und Definition of Done eindeutig sind.</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Naechster Fokus</p>
          <div className="mt-4 space-y-3">
            <FocusLine icon={FileText} label="Brief" value={project.metrics.acceptedRequirements > 0 ? 'Requirements vorhanden' : 'Schaerfen'} />
            <FocusLine icon={GitBranch} label="Plan" value={project.metrics.workPackages > 0 ? `${project.metrics.workPackages} Pakete` : 'Noch kein Paket'} />
            <FocusLine icon={PlayCircle} label="Umsetzung" value={project.metrics.delegations > 0 ? `${project.metrics.delegations} Delegationen` : 'Noch nicht gestartet'} />
          </div>
          <div className="mt-5 grid gap-2">
            <Link href={`/project-briefs/${project.id}`} className={buttonClassName('secondary', 'w-full')}>Blueprint oeffnen</Link>
            <Link href={`/delegations?new=1&briefId=${project.id}`} className={buttonClassName('ghost', 'w-full')}>Aufgabe delegieren</Link>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feature-Delegations</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Was wird in diesem Projekt umgesetzt?</h3>
          </div>
          <Link href={`/delegations?briefId=${project.id}`} className={buttonClassName('secondary')}>
            Alle Feature-Delegations anzeigen
          </Link>
        </div>
        {project.activeAgents.length > 0 && (
          <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] p-4">
            <p className="text-sm font-semibold text-violet-100">Aktive KI-Agenten in diesem Projekt</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {project.activeAgents.map(agent => (
                <Link key={agent.id} href={agent.href} className="rounded-lg border border-violet-500/15 bg-slate-950/70 p-3 transition hover:border-violet-400/35">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{agent.title}</p>
                      <p className="mt-1 text-xs text-violet-200/70">{agent.agent} · {agent.route}</p>
                    </div>
                    <Badge tone={delegationStatusTone[agent.status] ?? 'neutral'}>{agent.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07]">
          {project.recentDelegations.length === 0 ? (
            <div className="p-5">
              <p className="text-sm font-semibold text-white">Noch keine Feature-Delegation in diesem Projekt</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Sobald du aus dem Projekt ein neues Feature delegierst, erscheinen hier Ziel, Agent, Status und letzter Stand.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {project.recentDelegations.map(delegation => (
                <Link key={delegation.id} href={delegation.href} className="grid gap-3 p-4 transition hover:bg-white/[0.025] md:grid-cols-[minmax(0,1fr)_120px_120px_120px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{delegation.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Aktualisiert {new Date(delegation.updatedAt).toLocaleString('de-DE')}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{delegation.agent}</span>
                  <span className="text-xs text-slate-500">{delegation.route}</span>
                  <Badge tone={delegationStatusTone[delegation.status] ?? 'neutral'}>{delegation.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-200">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">KI Projektmanager</p>
                <h3 className="text-lg font-semibold text-white">Empfohlene Reihenfolge</h3>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{project.pmPlan.summary}</p>
          </div>
          <button
            type="button"
            onClick={onRunProjectManager}
            disabled={pmBusy || project.pmPlan.nextSteps.every(step => !step.canAutoStart)}
            className={cx(buttonClassName('primary', 'shrink-0'), 'disabled:cursor-not-allowed disabled:opacity-45')}
          >
            <Rocket className="h-4 w-4" aria-hidden="true" />
            {pmBusy ? 'PM startet Batch...' : 'Sicheren Batch starten'}
          </button>
        </div>
        {pmMessage && (
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-200">
            {pmMessage}
          </div>
        )}
        <div className="mt-5 grid gap-3">
          {project.pmPlan.nextSteps.map((step, index) => (
            <Link
              key={step.id}
              href={step.href}
              className="grid gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-violet-500/30 hover:bg-violet-500/[0.04] md:grid-cols-[36px_minmax(0,1fr)_150px]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-slate-950 text-sm font-bold text-slate-300">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{step.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{step.reason}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 md:justify-end">
                {step.riskClass && <Badge tone={step.riskClass === 'C' ? 'danger' : step.riskClass === 'B' ? 'warning' : 'success'}>Risk {step.riskClass}</Badge>}
                <Badge tone={step.canAutoStart ? 'success' : 'neutral'}>{pmActionLabel(step.action)}</Badge>
              </span>
            </Link>
          ))}
        </div>
      </Panel>

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

function PortfolioMetric({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'info' | 'success' | 'danger' }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 text-center">
      <p className={cx('text-lg font-semibold', tone === 'success' ? 'text-emerald-300' : tone === 'info' ? 'text-violet-300' : tone === 'danger' ? 'text-rose-300' : 'text-white')}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{label}</p>
    </div>
  )
}

function FocusLine({ icon: Icon, label, value }: { icon: typeof ListChecks; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-slate-950 px-3 py-2.5">
      <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <Icon className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        {label}
      </span>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  )
}
