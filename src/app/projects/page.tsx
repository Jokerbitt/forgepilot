'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleDot, FileText, GitBranch, ListChecks, PlayCircle, ShieldCheck } from 'lucide-react'
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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

  const selectedProject = useMemo(() => projects.find(project => project.id === selectedId) ?? projects[0], [projects, selectedId])
  const portfolio = useMemo(() => ({
    total: projects.length,
    ready: projects.filter(project => project.status === 'ready').length,
    active: projects.filter(project => project.status === 'in_progress').length,
    attention: projects.filter(project => project.status === 'attention').length,
  }), [projects])

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
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Planning Control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Der rote Faden von Idee zu Meilenstein, Arbeitspaket, Delegation und Review.
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
              <PortfolioMetric label="Klaerung" value={portfolio.attention} tone="danger" />
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projektliste</p>
            </div>
            {loading ? (
              <div className="space-y-3 p-4">{[0, 1, 2].map(item => <div key={item} className="h-20 rounded-lg border border-white/[0.06] bg-white/[0.03]" />)}</div>
            ) : projects.length === 0 ? (
              <div className="p-5">
                <p className="text-sm font-semibold text-white">Noch kein Projekt angelegt</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Starte mit einer Idee, damit ForgePilot daraus einen steuerbaren Plan macht.</p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-2">
                {projects.map(project => (
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
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{project.metrics.workPackages} Pakete</span>
                      <Badge tone={statusMeta[project.status].tone}>{statusMeta[project.status].label}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </aside>

        <section className="min-w-0">
          {selectedProject ? <ProjectBlueprint project={selectedProject} /> : (
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

function ProjectBlueprint({ project }: { project: ProjectSummary }) {
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
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">{project.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{project.problemStatement || meta.description}</p>
          </div>
          <Link href={project.nextAction.href} className={buttonClassName(project.nextAction.tone === 'danger' ? 'destructive' : 'primary', 'shrink-0')}>
            {project.nextAction.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Blueprint</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Chronologischer Aufbau</h3>
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
    </div>
  )
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
