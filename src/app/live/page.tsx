'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Monitor,
  PlayCircle,
  RefreshCw,
  Route,
  Shield,
} from 'lucide-react'
import { LiveAgentActivityPanel } from '@/components/live/LiveAgentActivityPanel'
import { buttonClassName, cx } from '@/components/ui/primitives'
import { AgentWorkbenchSummary } from '@/components/workbench/AgentWorkbenchSummary'

type Tone = 'ready' | 'attention' | 'blocked' | 'neutral'

interface EndpointState {
  label: string
  href: string
  status: Tone
  detail: string
}

interface DelegationStatsResponse {
  total?: number
  running?: number
  pending?: number
  approved?: number
  completed?: number
  failed?: number
  prCreated?: number
}

interface ProjectBriefListItem {
  id: string
  title: string
  status?: string
  targetPlatform?: string
  persistenceStrategy?: string
  desiredOutcome?: string
  rawIdea?: string
  updatedAt?: string
  delegationIds?: string[]
}

interface DelegationListItem {
  id: string
  title?: string
  status: string
  briefId?: string
  briefTitle?: string
  updatedAt?: string
  contract?: {
    goal?: string
    riskClass?: string
    requiresApproval?: boolean
  }
  summaryReport?: {
    prUrl?: string
    prState?: string
  }
}

interface LiveProjectCard {
  id: string
  title: string
  status: string
  platform: string
  persistence: string
  description: string
  previewHref?: string
  projectHref: string
  delegationsHref: string
  delegations: DelegationListItem[]
  runningCount: number
  completedCount: number
  failedCount: number
  nextDelegation?: DelegationListItem
}

interface StorageStatusResponse {
  mode?: string
  readsFrom?: string
  writesTo?: string[]
  postgresEnabled?: boolean
}

interface ExecuteHealthResponse {
  ready?: boolean
  executionMode?: string
  zeroKeyReady?: boolean
  apiKeysOptional?: boolean
  checks?: Record<string, { ok: boolean; detail: string }>
}

interface CliStatusResponse {
  activeMode?: 'claude-cli' | 'codex-cli' | 'claude-api' | 'openai-api' | 'simulation'
  zeroKeyReady?: boolean
  apiKeysOptional?: boolean
  recommendation?: string
  claude?: { available?: boolean; version?: string | null; detail?: string }
  codex?: { available?: boolean; version?: string | null; detail?: string }
}

interface DailyReportResponse {
  dailyAssistant?: {
    status?: 'ready' | 'attention' | 'blocked'
    score?: number
    nextFocus?: string
  }
  firstRealValueLoop?: {
    progressPct?: number
    currentStep?: { label?: string; action?: string }
  }
  executeLoopEvidence?: {
    provenRuns?: number
    targetRuns?: number
    nextAction?: string
  }
  status?: {
    operations?: {
      authDisabled?: boolean
      storageMode?: string
    }
  }
}

interface DemoRunResponse {
  ok?: boolean
  title?: string
  projectId?: string
  projectHref?: string
  delegationHref?: string
  appPreviewHref?: string
  nextAction?: string
  error?: string
}

interface RunnerPrResponse {
  ok?: boolean
  reused?: boolean
  delegationHref?: string
  status?: string
  execution?: { started?: boolean; mode?: string; error?: string } | null
  nextAction?: string
  error?: string
}

interface AutopilotReadinessCheck {
  id: string
  label: string
  status: Tone
  detail: string
  action?: string
}

interface AutopilotReadinessResponse {
  status?: Tone
  score?: number
  mode?: string
  canStartDemoRun?: boolean
  canExecuteCode?: boolean
  canCreatePr?: boolean
  canAutoMerge?: boolean
  recommendation?: string
  checks?: AutopilotReadinessCheck[]
  checkedAt?: string
}

interface AppBuilderCapability {
  level?: 'blocked' | 'small-app' | 'multi-slice-mvp' | 'large-app-assisted'
  score?: number
  title?: string
  summary?: string
  canBuildSmallApp?: boolean
  canBuildMultiSliceMvp?: boolean
  canRunFullyAutonomous?: boolean
  projectPipeline?: ProjectPipelineSummary
  safeNextAction?: {
    label: string
    href: string
    mode: 'plan' | 'execute' | 'review' | 'repair'
  }
  gates?: Array<{
    id: string
    label: string
    ready: boolean
    detail: string
  }>
  workflow?: Array<{
    id: string
    title: string
    detail: string
    state: 'now' | 'next' | 'later' | 'blocked'
  }>
}

interface ProjectPipelineSummary {
  projectCount?: number
  workPackageCount?: number
  safeSliceCount?: number
  blockedByDependencyCount?: number
  inFlightSliceCount?: number
  completedSliceCount?: number
  recommendation?: string
  nextCandidate?: {
    id: string
    projectId: string
    projectTitle: string
    title: string
    riskClass: string
    priority: string
    status: string
    href: string
    reason: string
  } | null
}

interface AssistantRoadmap {
  title?: string
  summary?: string
  focusMilestoneId?: string
  nextAutonomousStep?: {
    label: string
    detail: string
    href: string
    mode: 'plan' | 'execute' | 'validate' | 'review' | 'configure'
  }
  milestones?: Array<{
    id: string
    title: string
    goal: string
    status: 'done' | 'active' | 'blocked' | 'next'
    progress: number
    whyItMatters: string
    acceptanceCriteria: string[]
    nextAction: {
      label: string
      href: string
      mode: 'plan' | 'execute' | 'validate' | 'review' | 'configure'
    }
  }>
}

interface DailyAssistantSnapshotResponse {
  status?: Tone
  readinessScore?: number
  autonomyText?: string
  appBuilder?: AppBuilderCapability
  projectPipeline?: ProjectPipelineSummary
  roadmap?: AssistantRoadmap
  stats?: {
    pending?: number
    approved?: number
    running?: number
    failed?: number
    prOpen?: number
    prMerged?: number
  }
  queueHygiene?: {
    totalItems?: number
    visibleCount?: number
    hiddenDuplicateCount?: number
    noisyTestCount?: number
    riskCCount?: number
    recommendation?: string
    duplicateGroups?: Array<{
      title: string
      count: number
      representativeId: string
      hiddenCount?: number
    }>
    visibleItems?: Array<{
      id: string
      title: string
      status: string
      riskClass: string
      requiresApproval?: boolean
    }>
  }
  deliveryGate?: {
    status?: Tone
    message?: string
    action?: {
      type: 'quality_check' | 'critic_review' | 'create_pr' | 'review_pr' | 'repair_required'
      label: string
      reason: string
      delegation: {
        id: string
        title: string
        href: string
        prUrl?: string
        riskClass: string
      }
    } | null
    repairDelegation?: {
      id: string
      title: string
      href: string
      status: string
      riskClass: string
    } | null
  }
}

interface AssistantCycleResponse {
  ok?: boolean
  status?: string
  message?: string
  started?: boolean
  candidate?: { id: string; title: string; href: string } | null
  error?: string
}

function toneClasses(tone: Tone): string {
  if (tone === 'ready') return 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-200'
  if (tone === 'attention') return 'border-amber-500/20 bg-amber-500/[0.07] text-amber-200'
  if (tone === 'blocked') return 'border-red-500/20 bg-red-500/[0.07] text-red-200'
  return 'border-white/[0.08] bg-white/[0.035] text-slate-300'
}

function statusLabel(tone: Tone): string {
  if (tone === 'ready') return 'Bereit'
  if (tone === 'attention') return 'Prüfen'
  if (tone === 'blocked') return 'Blockiert'
  return 'Info'
}

function roadmapModeLabel(mode?: NonNullable<AssistantRoadmap['nextAutonomousStep']>['mode']): string {
  if (mode === 'execute') return 'Ausführen'
  if (mode === 'validate') return 'Prüfen'
  if (mode === 'review') return 'Entscheiden'
  if (mode === 'configure') return 'Einrichten'
  if (mode === 'plan') return 'Planen'
  return 'Nächster Schritt'
}

function statusIcon(tone: Tone) {
  if (tone === 'ready') return <CheckCircle2 className="h-4 w-4" />
  if (tone === 'attention') return <AlertTriangle className="h-4 w-4" />
  if (tone === 'blocked') return <AlertTriangle className="h-4 w-4" />
  return <Activity className="h-4 w-4" />
}

function isTodoProject(project: Pick<ProjectBriefListItem, 'title' | 'rawIdea' | 'desiredOutcome'>): boolean {
  const source = `${project.title} ${project.rawIdea ?? ''} ${project.desiredOutcome ?? ''}`.toLowerCase()
  return source.includes('todo') || source.includes('to-do') || source.includes('task planner')
}

function buildLiveProjectCards(
  projects: ProjectBriefListItem[],
  delegations: DelegationListItem[],
): LiveProjectCard[] {
  const sourceProjects = projects.length > 0
    ? projects
    : [{
        id: 'demo-todo-planner',
        title: 'Demo: ToDo Planner WebApp',
        status: 'demo',
        targetPlatform: 'webapp',
        persistenceStrategy: 'localStorage',
        desiredOutcome: 'Testbare App-Vorschau mit Aufgaben, Fortschritt und lokaler Speicherung.',
      }]

  return sourceProjects.map(project => {
    const projectDelegations = delegations.filter(delegation => (
      delegation.briefId === project.id
      || delegation.briefTitle === project.title
      || project.delegationIds?.includes(delegation.id)
    ))
    const runningCount = projectDelegations.filter(delegation => delegation.status === 'running').length
    const completedCount = projectDelegations.filter(delegation => delegation.status === 'completed').length
    const failedCount = projectDelegations.filter(delegation => delegation.status === 'failed').length
    const nextDelegation = projectDelegations.find(delegation => ['running', 'approved', 'pending', 'failed'].includes(delegation.status))
      ?? projectDelegations[0]

    return {
      id: project.id,
      title: project.title,
      status: project.status ?? 'unknown',
      platform: project.targetPlatform ?? 'unbekannt',
      persistence: project.persistenceStrategy ?? 'unbekannt',
      description: project.desiredOutcome ?? project.rawIdea ?? 'Noch keine Beschreibung vorhanden.',
      previewHref: isTodoProject(project) ? '/demo/todo-planner' : undefined,
      projectHref: `/projects/${project.id}`,
      delegationsHref: `/delegations?briefId=${encodeURIComponent(project.id)}`,
      delegations: projectDelegations,
      runningCount,
      completedCount,
      failedCount,
      nextDelegation,
    }
  })
}

async function fetchJson<T>(href: string, timeoutMs = 5000): Promise<{ ok: true; data: T } | { ok: false; detail: string }> {
  const controller = new AbortController()
  let timeoutId: number | null = null
  const timeoutPromise = new Promise<{ ok: false; detail: string }>(resolve => {
    timeoutId = window.setTimeout(() => {
      controller.abort()
      resolve({ ok: false, detail: `Timeout nach ${Math.round(timeoutMs / 1000)}s` })
    }, timeoutMs)
  })

  const fetchPromise = (async (): Promise<{ ok: true; data: T } | { ok: false; detail: string }> => {
    const res = await fetch(href, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    return { ok: true, data: await res.json() as T }
  })()

  try {
    return await Promise.race([fetchPromise, timeoutPromise])
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, detail: `Timeout nach ${Math.round(timeoutMs / 1000)}s` }
    }
    return { ok: false, detail: error instanceof Error ? error.message : 'Nicht erreichbar' }
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId)
  }
}

export default function LiveViewPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectBriefListItem[]>([])
  const [projectDelegations, setProjectDelegations] = useState<DelegationListItem[]>([])
  const [delegations, setDelegations] = useState<DelegationStatsResponse | null>(null)
  const [storage, setStorage] = useState<StorageStatusResponse | null>(null)
  const [executeHealth, setExecuteHealth] = useState<ExecuteHealthResponse | null>(null)
  const [cliStatus, setCliStatus] = useState<CliStatusResponse | null>(null)
  const [dailyReport, setDailyReport] = useState<DailyReportResponse | null>(null)
  const [dailyAssistant, setDailyAssistant] = useState<DailyAssistantSnapshotResponse | null>(null)
  const [autopilotReadiness, setAutopilotReadiness] = useState<AutopilotReadinessResponse | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)
  const [assistantCycleLoading, setAssistantCycleLoading] = useState(false)
  const [assistantCycleResult, setAssistantCycleResult] = useState<AssistantCycleResponse | null>(null)
  const [demoRun, setDemoRun] = useState<DemoRunResponse | null>(null)
  const [demoRunLoading, setDemoRunLoading] = useState(false)
  const [runnerPr, setRunnerPr] = useState<RunnerPrResponse | null>(null)
  const [runnerPrLoading, setRunnerPrLoading] = useState(false)
  const [endpoints, setEndpoints] = useState<EndpointState[]>([])

  const refresh = async () => {
    setLoading(true)
    const [healthRes, statsRes, storageRes, executeRes, cliRes, reportRes, autopilotRes, assistantRes, projectsRes, delegationsRes] = await Promise.all([
      fetchJson<{ status?: string }>('/api/health'),
      fetchJson<DelegationStatsResponse>('/api/delegations/stats'),
      fetchJson<StorageStatusResponse>('/api/storage-status'),
      fetchJson<ExecuteHealthResponse>('/api/execute-loop/health'),
      fetchJson<CliStatusResponse>('/api/system/cli-status'),
      fetchJson<DailyReportResponse>('/api/reports/daily', 8000),
      fetchJson<AutopilotReadinessResponse>('/api/autopilot/readiness', 8000),
      fetchJson<DailyAssistantSnapshotResponse>('/api/daily-assistant', 16000),
      fetchJson<ProjectBriefListItem[]>('/api/project-briefs', 8000),
      fetchJson<DelegationListItem[]>('/api/delegations?limit=200', 8000),
    ])

    if (projectsRes.ok) setProjects(projectsRes.data)
    if (delegationsRes.ok) setProjectDelegations(delegationsRes.data)
    if (statsRes.ok) setDelegations(statsRes.data)
    if (storageRes.ok) setStorage(storageRes.data)
    if (executeRes.ok) setExecuteHealth(executeRes.data)
    if (cliRes.ok) setCliStatus(cliRes.data)
    if (reportRes.ok) setDailyReport(reportRes.data)
    if (autopilotRes.ok) setAutopilotReadiness(autopilotRes.data)
    if (assistantRes.ok) setDailyAssistant(assistantRes.data)

    setEndpoints([
      {
        label: 'App Health',
        href: '/api/health',
        status: healthRes.ok && healthRes.data.status === 'ok' ? 'ready' : 'blocked',
        detail: healthRes.ok ? 'App antwortet.' : healthRes.detail,
      },
      {
        label: 'Delegations',
        href: '/api/delegations/stats',
        status: statsRes.ok ? 'ready' : 'blocked',
        detail: statsRes.ok
          ? `${statsRes.data.total ?? 0} gesamt, ${statsRes.data.running ?? 0} laufen, ${statsRes.data.failed ?? 0} fehlerhaft.`
          : statsRes.detail,
      },
      {
        label: 'Storage',
        href: '/api/storage-status',
        status: storageRes.ok && storageRes.data.mode !== 'json' ? 'ready' : storageRes.ok ? 'attention' : 'blocked',
        detail: storageRes.ok ? `Modus: ${storageRes.data.mode ?? storageRes.data.readsFrom ?? 'unbekannt'}` : storageRes.detail,
      },
      {
        label: 'Execute Loop',
        href: '/api/execute-loop/health',
        status: executeRes.ok && executeRes.data.ready ? 'ready' : executeRes.ok ? 'attention' : 'blocked',
        detail: executeRes.ok ? executeRes.data.executionMode ?? 'Status verfügbar.' : executeRes.detail,
      },
      {
        label: 'Zero-Key Agenten',
        href: '/api/system/cli-status',
        status: cliRes.ok && cliRes.data.zeroKeyReady ? 'ready' : cliRes.ok ? 'attention' : 'blocked',
        detail: cliRes.ok ? cliRes.data.recommendation ?? cliRes.data.activeMode ?? 'Status verfügbar.' : cliRes.detail,
      },
      {
        label: 'Daily Report',
        href: '/api/reports/daily?format=markdown',
        status: reportRes.ok
          ? reportRes.data.dailyAssistant?.status === 'ready'
            ? 'ready'
            : reportRes.data.dailyAssistant?.status === 'blocked'
              ? 'blocked'
              : 'attention'
          : 'blocked',
        detail: reportRes.ok
          ? `${reportRes.data.dailyAssistant?.score ?? 0}/100, Fokus: ${reportRes.data.dailyAssistant?.nextFocus ?? 'unbekannt'}`
          : reportRes.detail,
      },
      {
        label: 'Autopilot',
        href: '/api/autopilot/readiness',
        status: autopilotRes.ok ? autopilotRes.data.status ?? 'attention' : 'blocked',
        detail: autopilotRes.ok
          ? `${autopilotRes.data.score ?? 0}/100, Modus: ${autopilotRes.data.mode ?? 'unbekannt'}`
          : autopilotRes.detail,
      },
      {
        label: 'Daily Assistant',
        href: '/api/daily-assistant',
        status: assistantRes.ok ? assistantRes.data.status ?? 'attention' : 'blocked',
        detail: assistantRes.ok
          ? `${assistantRes.data.appBuilder?.score ?? assistantRes.data.readinessScore ?? 0}/100, ${assistantRes.data.appBuilder?.title ?? 'Assistant geladen'}`
          : assistantRes.detail,
      },
    ])
    setLastCheckedAt(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 30000)
    return () => clearInterval(interval)
  }, [])

  const overallTone: Tone = useMemo(() => {
    if (endpoints.some(endpoint => endpoint.status === 'blocked')) return 'blocked'
    if (endpoints.some(endpoint => endpoint.status === 'attention')) return 'attention'
    if (endpoints.length > 0) return 'ready'
    return 'neutral'
  }, [endpoints])

  const firstRealValueProgress = dailyReport?.firstRealValueLoop?.progressPct ?? 0
  const provenRuns = dailyReport?.executeLoopEvidence?.provenRuns ?? 0
  const targetRuns = dailyReport?.executeLoopEvidence?.targetRuns ?? 5
  const liveProjects = useMemo(
    () => buildLiveProjectCards(projects, projectDelegations),
    [projectDelegations, projects],
  )
  const selectedProject = liveProjects.find(project => project.id === selectedProjectId)
    ?? liveProjects.find(project => project.previewHref)
    ?? liveProjects[0]
  const selectedProjectDelegations = selectedProject?.delegations ?? []
  const previewUrl = selectedProject?.previewHref
  const zeroKeyLabel = cliStatus?.activeMode === 'claude-cli'
    ? 'Claude Max bereit'
    : cliStatus?.activeMode === 'codex-cli'
      ? 'Codex CLI bereit'
      : cliStatus?.zeroKeyReady
        ? 'CLI bereit'
        : 'CLI prüfen'
  const autopilotTone = autopilotReadiness?.status ?? 'attention'
  const runnerPrBlocked = autopilotReadiness ? !autopilotReadiness.canExecuteCode : false
  const appBuilder = dailyAssistant?.appBuilder
  const roadmap = dailyAssistant?.roadmap
  const appBuilderTone: Tone = appBuilder?.level === 'blocked'
    ? 'blocked'
    : appBuilder?.canRunFullyAutonomous
      ? 'ready'
      : appBuilder?.canBuildSmallApp
        ? 'attention'
        : 'blocked'

  return (
    <main className="min-h-screen bg-[#08080d] px-5 py-6 text-slate-100 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-xl border border-white/[0.07] bg-white/[0.035] p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-3 py-1 text-xs font-semibold text-violet-200">
              <Monitor className="h-3.5 w-3.5" />
              Live View
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Aktueller Stand der App
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Prüfe in einer Ansicht, ob ForgePilot läuft, welche Kernbereiche testbar sind und wie die App
              für dich gerade aussieht. Die Vorschau ist bewusst auf den V1-Kern reduziert.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold', toneClasses(overallTone))}>
              {statusIcon(overallTone)}
              {statusLabel(overallTone)}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-violet-500/30 hover:bg-violet-500/10 disabled:opacity-50"
            >
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
              Stand abrufen
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-4">
          <StatusCard
            icon={<Activity className="h-5 w-5" />}
            label="Delegations"
            value={`${delegations?.running ?? 0} aktiv`}
            detail={`${delegations?.pending ?? 0} pending, ${delegations?.approved ?? 0} freigegeben, ${delegations?.failed ?? 0} fehlerhaft`}
            tone={(delegations?.failed ?? 0) > 0 ? 'attention' : 'ready'}
          />
          <StatusCard
            icon={<Route className="h-5 w-5" />}
            label="First Real Value Loop"
            value={`${firstRealValueProgress}%`}
            detail={dailyReport?.firstRealValueLoop?.currentStep?.label ?? 'Noch kein Report geladen'}
            tone={firstRealValueProgress >= 100 ? 'ready' : firstRealValueProgress > 0 ? 'attention' : 'blocked'}
          />
          <StatusCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Execute Evidence"
            value={`${provenRuns}/${targetRuns}`}
            detail={dailyReport?.executeLoopEvidence?.nextAction ?? 'Echte Produktivläufe sammeln'}
            tone={provenRuns >= targetRuns ? 'ready' : provenRuns > 0 ? 'attention' : 'blocked'}
          />
          <StatusCard
            icon={<Shield className="h-5 w-5" />}
            label="Zero-Key Ausführung"
            value={zeroKeyLabel}
            detail={cliStatus?.recommendation ?? 'Claude/Codex CLI prüfen. API-Keys bleiben optional.'}
            tone={cliStatus?.zeroKeyReady ? 'ready' : 'attention'}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Ausführungsmodus</p>
                <h2 className="mt-1 text-xl font-bold text-white">{zeroKeyLabel}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  ForgePilot bevorzugt authentifizierte lokale CLIs, damit du Claude Max oder Codex ohne API-Key
                  nutzen kannst. API-Keys sind nur ein optionaler Fallback.
                </p>
              </div>
              <span className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold', toneClasses(cliStatus?.zeroKeyReady ? 'ready' : 'attention'))}>
                {statusIcon(cliStatus?.zeroKeyReady ? 'ready' : 'attention')}
                {cliStatus?.activeMode ?? 'lädt'}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ToolReadiness
                label="Claude Code / Max"
                available={Boolean(cliStatus?.claude?.available)}
                detail={cliStatus?.claude?.detail ?? 'Status wird geladen.'}
                version={cliStatus?.claude?.version}
              />
              <ToolReadiness
                label="Codex CLI"
                available={Boolean(cliStatus?.codex?.available)}
                detail={cliStatus?.codex?.detail ?? 'Status wird geladen.'}
                version={cliStatus?.codex?.version}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Betrieb</p>
            <p className="mt-1 text-xl font-bold text-white">{storage?.mode ?? dailyReport?.status?.operations?.storageMode ?? 'unbekannt'}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {dailyReport?.status?.operations?.authDisabled ? 'Login ist lokal deaktiviert, damit du vor Launch schnell testen kannst.' : 'Login ist aktiv.'}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Execute Loop: {executeHealth?.executionMode ?? 'noch nicht geladen'}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100/70">
                  Autopilot Readiness
                </p>
                <span className={cx('inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold', toneClasses(autopilotTone))}>
                  {statusIcon(autopilotTone)}
                  {autopilotReadiness?.score ?? 0}/100
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-white">Bereit für autonomen App-Run?</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                {autopilotReadiness?.recommendation ?? 'ForgePilot prüft gerade, ob echter Runner, GitHub-PR-Flow, Git-Status und Validierung bereit sind.'}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <CapabilityPill label="Code ausführen" ready={Boolean(autopilotReadiness?.canExecuteCode)} />
                <CapabilityPill label="Demo starten" ready={Boolean(autopilotReadiness?.canStartDemoRun)} />
                <CapabilityPill label="PR erstellen" ready={Boolean(autopilotReadiness?.canCreatePr)} />
                <CapabilityPill label="Auto-Merge" ready={Boolean(autopilotReadiness?.canAutoMerge)} />
              </div>
            </div>
            <button
              type="button"
              disabled={readinessLoading}
              onClick={async () => {
                setReadinessLoading(true)
                try {
                  await fetch('/api/system/runner-readiness', { method: 'POST' })
                  await refresh()
                } finally {
                  setReadinessLoading(false)
                }
              }}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cx('h-4 w-4', readinessLoading && 'animate-spin')} />
              {readinessLoading ? 'Prüfe Runner...' : 'Deep Readiness prüfen'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(autopilotReadiness?.checks ?? []).slice(0, 6).map(check => (
              <div key={check.id} className="rounded-lg border border-white/[0.07] bg-black/15 p-3">
                <div className="flex items-start gap-3">
                  <span className={cx('mt-0.5 inline-flex rounded-full border p-1', toneClasses(check.status))}>
                    {statusIcon(check.status)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{check.label}</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-50/65">{check.detail}</p>
                    {check.action && <p className="mt-1 text-xs leading-5 text-amber-100/75">{check.action}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-sky-500/20 bg-sky-500/[0.055] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-sky-100/70">
                  <Bot className="h-3.5 w-3.5" />
                  Daily App Builder
                </p>
                <span className={cx('inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold', toneClasses(appBuilderTone))}>
                  {statusIcon(appBuilderTone)}
                  {appBuilder?.score ?? 0}/100
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-white">
                {appBuilder?.title ?? 'Assistant bewertet größere App-Runs'}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-50/75">
                {appBuilder?.summary ?? 'ForgePilot kombiniert Readiness, Queue, PR-Flow und Fehlerlage, um den nächsten sicheren App-Build-Schritt zu wählen.'}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <CapabilityPill label="Kleine App" ready={Boolean(appBuilder?.canBuildSmallApp)} />
                <CapabilityPill label="Multi-Slice MVP" ready={Boolean(appBuilder?.canBuildMultiSliceMvp)} />
                <CapabilityPill label="Vollautonomer Zyklus" ready={Boolean(appBuilder?.canRunFullyAutonomous)} />
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col">
              {appBuilder?.safeNextAction && (
                <Link
                  href={appBuilder.safeNextAction.href}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-sky-400/50 bg-sky-500/15 px-3.5 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25"
                >
                  {appBuilder.safeNextAction.label}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              )}
              <button
                type="button"
                disabled={assistantCycleLoading}
                onClick={async () => {
                  setAssistantCycleLoading(true)
                  setAssistantCycleResult(null)
                  try {
                    const response = await fetch('/api/daily-assistant/autonomy-cycle', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ force: true }),
                    })
                    const data = await response.json() as AssistantCycleResponse
                    setAssistantCycleResult(response.ok ? data : { ok: false, error: data.error ?? data.message ?? `HTTP ${response.status}` })
                    await refresh()
                  } catch (error) {
                    setAssistantCycleResult({ ok: false, error: error instanceof Error ? error.message : 'Assistant-Zyklus konnte nicht gestartet werden.' })
                  } finally {
                    setAssistantCycleLoading(false)
                  }
                }}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/40 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" />
                {assistantCycleLoading ? 'Assistant arbeitet...' : 'Assistant übernehmen lassen'}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-white/[0.07] bg-black/15 p-3">
              <p className="text-sm font-semibold text-white">Gates für größere Apps</p>
              <div className="mt-3 space-y-2">
                {(appBuilder?.gates ?? []).map(gate => (
                  <div key={gate.id} className="flex items-start gap-2 rounded-md border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
                    <span className={cx('mt-0.5 inline-flex rounded-full border p-1', toneClasses(gate.ready ? 'ready' : 'blocked'))}>
                      {statusIcon(gate.ready ? 'ready' : 'blocked')}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-slate-100">{gate.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-sky-50/55">{gate.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-black/15 p-3">
              <p className="text-sm font-semibold text-white">Autonomer App-Workflow</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(appBuilder?.workflow ?? []).map(step => (
                  <div key={step.id} className={cx(
                    'rounded-md border px-2.5 py-2',
                    step.state === 'now' ? 'border-sky-400/30 bg-sky-500/10' : step.state === 'blocked' ? 'border-red-500/20 bg-red-500/10' : 'border-white/[0.06] bg-white/[0.025]',
                  )}>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                      {step.state === 'now' ? 'Jetzt' : step.state === 'next' ? 'Danach' : step.state === 'blocked' ? 'Blockiert' : 'Später'}
                    </span>
                    <p className="mt-1 text-xs font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-sky-50/55">{step.detail}</p>
                  </div>
                ))}
              </div>
              {assistantCycleResult && (
                <div className={cx(
                  'mt-3 rounded-md border px-3 py-2 text-xs leading-5',
                  assistantCycleResult.ok === false
                    ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
                    : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
                )}>
                  {assistantCycleResult.error ?? assistantCycleResult.message ?? 'Assistant-Zyklus geprüft.'}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/15 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Projekt-Pipeline</p>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-sky-50/60">
                  {dailyAssistant?.projectPipeline?.recommendation
                    ?? appBuilder?.projectPipeline?.recommendation
                    ?? 'ForgePilot sammelt Projektpläne und zeigt den nächsten sicheren Slice für größere Apps.'}
                </p>
                {(dailyAssistant?.projectPipeline?.nextCandidate ?? appBuilder?.projectPipeline?.nextCandidate) && (
                  <p className="mt-1 text-[11px] leading-5 text-sky-100/70">
                    Nächster Slice: {(dailyAssistant?.projectPipeline?.nextCandidate ?? appBuilder?.projectPipeline?.nextCandidate)?.title}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs sm:min-w-[420px]">
                <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-2">
                  <span className="block font-bold text-white">{dailyAssistant?.projectPipeline?.projectCount ?? appBuilder?.projectPipeline?.projectCount ?? 0}</span>
                  <span className="text-slate-500">Projekte</span>
                </span>
                <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-2">
                  <span className="block font-bold text-white">{dailyAssistant?.projectPipeline?.workPackageCount ?? appBuilder?.projectPipeline?.workPackageCount ?? 0}</span>
                  <span className="text-slate-500">Pakete</span>
                </span>
                <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-2">
                  <span className="block font-bold text-white">{dailyAssistant?.projectPipeline?.safeSliceCount ?? appBuilder?.projectPipeline?.safeSliceCount ?? 0}</span>
                  <span className="text-slate-500">startbereit</span>
                </span>
                <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-2">
                  <span className="block font-bold text-white">{dailyAssistant?.projectPipeline?.blockedByDependencyCount ?? appBuilder?.projectPipeline?.blockedByDependencyCount ?? 0}</span>
                  <span className="text-slate-500">wartend</span>
                </span>
              </div>
            </div>
            {(dailyAssistant?.projectPipeline?.nextCandidate ?? appBuilder?.projectPipeline?.nextCandidate) && (
              <div className="mt-3 flex flex-col gap-2 rounded-md border border-sky-400/20 bg-sky-500/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-sky-50">
                    {(dailyAssistant?.projectPipeline?.nextCandidate ?? appBuilder?.projectPipeline?.nextCandidate)?.projectTitle}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-sky-50/65">
                    {(dailyAssistant?.projectPipeline?.nextCandidate ?? appBuilder?.projectPipeline?.nextCandidate)?.reason}
                  </p>
                </div>
                <Link
                  href={(dailyAssistant?.projectPipeline?.nextCandidate ?? appBuilder?.projectPipeline?.nextCandidate)?.href ?? '/projects'}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/25"
                >
                  Projekt öffnen
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/15 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Ruhige Arbeitsqueue</p>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-sky-50/60">
                  {dailyAssistant?.queueHygiene?.recommendation ?? 'ForgePilot verdichtet Duplikate und Test-Rauschen, damit du nur die nächsten sinnvollen Schritte siehst.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-[320px]">
                <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-2">
                  <span className="block font-bold text-white">{dailyAssistant?.queueHygiene?.visibleCount ?? 0}</span>
                  <span className="text-slate-500">sichtbar</span>
                </span>
                <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-2">
                  <span className="block font-bold text-white">{dailyAssistant?.queueHygiene?.hiddenDuplicateCount ?? 0}</span>
                  <span className="text-slate-500">Duplikate</span>
                </span>
                <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-2">
                  <span className="block font-bold text-white">{dailyAssistant?.queueHygiene?.noisyTestCount ?? 0}</span>
                  <span className="text-slate-500">Test-Rauschen</span>
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {(dailyAssistant?.queueHygiene?.visibleItems ?? []).slice(0, 6).map(item => (
                <Link
                  key={item.id}
                  href={`/delegations/${item.id}`}
                  className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2 transition hover:border-sky-400/30 hover:bg-sky-500/10"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-semibold text-slate-100">{item.title}</span>
                    <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      {item.riskClass}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    {item.status === 'approved' ? 'freigegeben' : item.status === 'pending' ? 'wartet' : item.status}
                  </span>
                </Link>
              ))}
            </div>
            {(dailyAssistant?.queueHygiene?.duplicateGroups?.length ?? 0) > 0 && (
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Größte Gruppen: {(dailyAssistant?.queueHygiene?.duplicateGroups ?? [])
                  .slice(0, 3)
                  .map(group => `${group.title} (${group.count}x)`)
                  .join(', ')}
              </p>
            )}
          </div>

          <div className={cx(
            'mt-4 rounded-lg border p-3',
            toneClasses(dailyAssistant?.deliveryGate?.status ?? 'neutral'),
          )}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">PR- und Delivery-Gate</p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  {dailyAssistant?.deliveryGate?.message ?? 'ForgePilot prüft, ob abgeschlossene Arbeit Quality Check, Critic, PR oder Reparatur braucht.'}
                </p>
                {dailyAssistant?.deliveryGate?.action?.reason && (
                  <p className="mt-1 text-[11px] leading-5 opacity-70">{dailyAssistant.deliveryGate.action.reason}</p>
                )}
                {dailyAssistant?.deliveryGate?.repairDelegation && (
                  <p className="mt-2 text-[11px] leading-5 text-emerald-200/80">
                    Repair-Slice bereit: {dailyAssistant.deliveryGate.repairDelegation.title}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {dailyAssistant?.deliveryGate?.repairDelegation?.href && (
                  <Link href={dailyAssistant.deliveryGate.repairDelegation.href} className={buttonClassName('primary')}>
                    Repair öffnen
                  </Link>
                )}
                {dailyAssistant?.deliveryGate?.action?.delegation.href && (
                  <Link href={dailyAssistant.deliveryGate.action.delegation.href} className={buttonClassName('secondary')}>
                    Delegation öffnen
                  </Link>
                )}
                {dailyAssistant?.deliveryGate?.action?.delegation.prUrl && (
                  <a
                    href={dailyAssistant.deliveryGate.action.delegation.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClassName('primary')}
                  >
                    PR öffnen
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Roadmap zum echten Entwicklungs-Assistenten</p>
              <h2 className="mt-2 text-xl font-bold text-white">
                {roadmap?.title ?? 'ForgePilot wird schrittweise autonomer'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {roadmap?.summary ?? 'Der Daily Assistant priorisiert Runner-Stabilität, Live-Verständlichkeit, PR-Gates und Selbstoptimierung.'}
              </p>
            </div>
            {roadmap?.nextAutonomousStep && (
              <Link
                href={roadmap.nextAutonomousStep.href}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.055] px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:border-violet-400/40 hover:bg-violet-500/10"
              >
                {roadmap.nextAutonomousStep.label}
                <ExternalLink className="h-4 w-4" />
              </Link>
            )}
          </div>

          {roadmap?.nextAutonomousStep && (
            <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.07] px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-violet-100">Nächster autonomer Schritt</p>
                  <p className="mt-1 text-xs leading-5 text-violet-100/75">{roadmap.nextAutonomousStep.detail}</p>
                </div>
                <span className="inline-flex w-fit shrink-0 rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-100">
                  {roadmapModeLabel(roadmap.nextAutonomousStep.mode)}
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {(roadmap?.milestones ?? []).map(milestone => {
              const tone: Tone = milestone.status === 'done'
                ? 'ready'
                : milestone.status === 'blocked'
                  ? 'blocked'
                  : milestone.status === 'active'
                    ? 'attention'
                    : 'neutral'
              return (
                <article
                  key={milestone.id}
                  className={cx(
                    'rounded-lg border p-4',
                    roadmap?.focusMilestoneId === milestone.id
                      ? 'border-violet-400/40 bg-violet-500/[0.08]'
                      : 'border-white/[0.07] bg-black/15',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{milestone.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{milestone.goal}</p>
                    </div>
                    <span className={cx('shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold', toneClasses(tone))}>
                      {milestone.progress}%
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cx(
                        'h-full rounded-full',
                        tone === 'ready' ? 'bg-emerald-400' : tone === 'blocked' ? 'bg-rose-400' : tone === 'attention' ? 'bg-amber-300' : 'bg-slate-500',
                      )}
                      style={{ width: `${milestone.progress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{milestone.whyItMatters}</p>
                  {milestone.acceptanceCriteria.length > 0 && (
                    <details className="mt-3 rounded-md border border-white/[0.06] bg-black/10 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                        Akzeptanzkriterien
                      </summary>
                      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
                        {milestone.acceptanceCriteria.map(criterion => (
                          <li key={criterion} className="flex gap-2">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                            <span>{criterion}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                      {milestone.status === 'done' ? 'Erledigt' : milestone.status === 'blocked' ? 'Blockiert' : milestone.status === 'active' ? 'Aktiv' : 'Danach'}
                    </span>
                    <Link href={milestone.nextAction.href} className="text-xs font-semibold text-violet-300 hover:text-violet-200">
                      {milestone.nextAction.label}
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-200/70">First Real App Run</p>
              <h2 className="mt-1 text-xl font-bold text-white">ToDo WebApp Testlauf starten</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100/75">
                Erzeugt automatisch ein Projekt, eine Delegation, sichtbare Agenten-Logs und eine kleine testbare
                ToDo Planner WebApp. Ohne API-Key, mit Claude/Codex CLI als bevorzugtem Zero-Key-Modus.
              </p>
            </div>
            <button
              type="button"
              disabled={demoRunLoading}
              onClick={async () => {
                setDemoRunLoading(true)
                setDemoRun(null)
                try {
                  const res = await fetch('/api/demo-runs/todo-webapp', { method: 'POST' })
                  const data = await res.json() as DemoRunResponse
                  setDemoRun(res.ok ? data : { error: data.error ?? `HTTP ${res.status}` })
                  if (res.ok) {
                    await refresh()
                    setSelectedProjectId(data.projectId ?? null)
                  }
                } catch (error) {
                  setDemoRun({ error: error instanceof Error ? error.message : 'Demo-Run konnte nicht gestartet werden.' })
                } finally {
                  setDemoRunLoading(false)
                }
              }}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-400/70 bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" />
              {demoRunLoading ? 'Starte Testlauf...' : 'ToDo WebApp Run starten'}
            </button>
          </div>
          {demoRun && (
            <div className={cx(
              'mt-4 rounded-lg border px-4 py-3 text-sm',
              demoRun.error ? 'border-rose-500/25 bg-rose-500/10 text-rose-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
            )}>
              {demoRun.error ? (
                <p>{demoRun.error}</p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{demoRun.title ?? 'Demo-Run erstellt'}</p>
                    <p className="mt-1 text-xs opacity-80">{demoRun.nextAction}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {demoRun.delegationHref && <Link href={demoRun.delegationHref} className={buttonClassName('secondary')}>Delegation</Link>}
                    {demoRun.projectHref && <Link href={demoRun.projectHref} className={buttonClassName('secondary')}>Projekt</Link>}
                    {demoRun.appPreviewHref && <Link href={demoRun.appPreviewHref} className={buttonClassName('primary')}>Demo oeffnen</Link>}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-100">Haerterer Produktionsbeweis</p>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/70">
                  Erstellt eine kleine echte Runner-Delegation: ToDo Planner Aufgaben per localStorage speichern,
                  Reset-Aktion ergaenzen, validieren und PR erzeugen. Scope bleibt eng, damit der Runner realistisch fertig wird.
                </p>
              </div>
              <button
                type="button"
                disabled={runnerPrLoading || runnerPrBlocked}
                onClick={async () => {
                  setRunnerPrLoading(true)
                  setRunnerPr(null)
                  try {
                    const res = await fetch('/api/demo-runs/todo-webapp/runner-pr', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ execute: true, briefId: demoRun?.projectId }),
                    })
                    const data = await res.json() as RunnerPrResponse
                    setRunnerPr(res.ok ? data : { error: data.error ?? `HTTP ${res.status}` })
                    await refresh()
                    if (res.ok && data.delegationHref) {
                      window.location.assign(data.delegationHref)
                    }
                  } catch (error) {
                    setRunnerPr({ error: error instanceof Error ? error.message : 'Runner-PR konnte nicht gestartet werden.' })
                  } finally {
                    setRunnerPrLoading(false)
                  }
                }}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3.5 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" />
                {runnerPrLoading ? 'Runner startet...' : runnerPrBlocked ? 'Runner noch blockiert' : 'Echten Runner-PR starten'}
              </button>
            </div>
            {runnerPrBlocked && (
              <p className="mt-3 text-xs leading-5 text-amber-100/75">
                Erst Claude Code/Codex CLI anmelden oder einen optionalen API-Fallback aktivieren. Danach Deep Readiness prüfen.
              </p>
            )}
            {runnerPr && (
              <div className={cx(
                'mt-3 rounded-md border px-3 py-2 text-sm',
                runnerPr.error || runnerPr.execution?.error
                  ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
              )}>
                {runnerPr.error || runnerPr.execution?.error ? (
                  <p>{runnerPr.error ?? runnerPr.execution?.error}</p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      {runnerPr.execution?.started
                        ? `Runner gestartet (${runnerPr.execution.mode ?? 'auto'}).`
                        : runnerPr.nextAction}
                    </p>
                    {runnerPr.delegationHref && <Link href={runnerPr.delegationHref} className={buttonClassName('secondary')}>Runner-Delegation</Link>}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <LiveAgentActivityPanel />

        <AgentWorkbenchSummary />

        <section className="grid min-h-[720px] gap-5 xl:grid-cols-[420px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">Projekte</h2>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  {lastCheckedAt ?? 'lädt'}
                </span>
              </div>
              <div className="space-y-2">
                {liveProjects.map(project => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={cx(
                      'w-full rounded-lg border px-3 py-3 text-left transition',
                      selectedProject?.id === project.id
                        ? 'border-violet-500/40 bg-violet-500/[0.12]'
                        : 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.045]'
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-semibold text-slate-100">{project.title}</span>
                      <span className={cx(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        project.failedCount > 0
                          ? 'border-red-500/25 bg-red-500/10 text-red-200'
                          : project.runningCount > 0
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                            : project.previewHref
                              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                              : 'border-white/[0.08] bg-white/[0.04] text-slate-400',
                      )}>
                        {project.runningCount > 0 ? 'läuft' : project.previewHref ? 'Vorschau' : project.status}
                      </span>
                    </span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{project.description}</span>
                    <span className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500">
                      <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1">
                        {project.delegations.length} Tasks
                      </span>
                      <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1">
                        {project.platform}
                      </span>
                      <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1">
                        {project.persistence}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">Projektstatus</h2>
              {selectedProject ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                    <p className="text-sm font-semibold text-white">{selectedProject.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{selectedProject.description}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-2">
                        <span className="block font-bold text-white">{selectedProject.runningCount}</span>
                        <span className="text-slate-500">aktiv</span>
                      </span>
                      <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-2">
                        <span className="block font-bold text-white">{selectedProject.completedCount}</span>
                        <span className="text-slate-500">fertig</span>
                      </span>
                      <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-2">
                        <span className="block font-bold text-white">{selectedProject.failedCount}</span>
                        <span className="text-slate-500">Fehler</span>
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={selectedProject.projectHref} className={buttonClassName('secondary')}>
                        Projekt öffnen
                      </Link>
                      <Link href={selectedProject.delegationsHref} className={buttonClassName('secondary')}>
                        Delegationen
                      </Link>
                      {selectedProject.previewHref && (
                        <Link href={selectedProject.previewHref} className={buttonClassName('primary')}>
                          App öffnen
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedProjectDelegations.slice(0, 5).map(delegation => (
                      <Link
                        key={delegation.id}
                        href={`/delegations/${delegation.id}`}
                        className="block rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 transition hover:border-violet-500/30 hover:bg-violet-500/[0.05]"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-semibold text-slate-100">
                            {delegation.title ?? delegation.contract?.goal ?? delegation.id}
                          </span>
                          <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                            {delegation.status}
                          </span>
                        </span>
                      </Link>
                    ))}
                    {selectedProjectDelegations.length === 0 && (
                      <p className="rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-sm text-slate-500">
                        Noch keine Delegationen für dieses Projekt sichtbar.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Noch kein Projekt geladen.</p>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">Systemchecks</h2>
              <div className="space-y-2">
                {endpoints.slice(0, 5).map(endpoint => (
                  <a
                    key={endpoint.href}
                    href={endpoint.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-3 transition hover:border-white/[0.14]"
                  >
                    <span className={cx('mt-0.5 inline-flex rounded-full border p-1', toneClasses(endpoint.status))}>
                      {statusIcon(endpoint.status)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-100">{endpoint.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{endpoint.detail}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
              <h2 className="text-sm font-semibold text-violet-100">So testest du sinnvoll</h2>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-violet-100/75">
                <li>1. Command Center öffnen und prüfen, ob der nächste Schritt klar ist.</li>
                <li>2. Plan Mode starten und eine echte Idee eingeben.</li>
                <li>3. Ergebnis prüfen: Nutzen, MVP, Risiken, Arbeitspakete.</li>
                <li>4. Erst danach Ausführung starten und Delegation Detail beobachten.</li>
              </ol>
            </div>
          </aside>

          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#050509] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.035] px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Vorschau</p>
                <p className="truncate text-sm font-semibold text-white">
                  {selectedProject?.title ?? 'Kein Projekt ausgewählt'}
                </p>
              </div>
              {previewUrl ? (
                <Link
                  href={previewUrl}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-500/30 hover:bg-violet-500/10"
                >
                  App öffnen
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  href={selectedProject?.projectHref ?? '/projects'}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-500/30 hover:bg-violet-500/10"
                >
                  Projekt öffnen
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            {previewUrl ? (
              <iframe
                key={previewUrl}
                title="Projekt App-Vorschau"
                src={previewUrl}
                className="h-[720px] w-full bg-[#08080d]"
              />
            ) : (
              <div className="grid h-[720px] place-items-center px-6 text-center">
                <div className="max-w-md">
                  <Monitor className="mx-auto h-10 w-10 text-slate-600" />
                  <h3 className="mt-4 text-lg font-semibold text-white">Noch keine App-Vorschau erkannt</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Für dieses Projekt gibt es bereits Plan- und Delegationsdaten, aber noch keine testbare App-Route.
                    Starte einen App-Run oder öffne die Projektdetails, um den nächsten Slice zu erzeugen.
                  </p>
                  <Link href={selectedProject?.projectHref ?? '/projects'} className={buttonClassName('primary', 'mt-4')}>
                    Projekt öffnen
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function ToolReadiness({
  label,
  available,
  detail,
  version,
}: {
  label: string
  available: boolean
  detail: string
  version?: string | null
}) {
  const tone: Tone = available ? 'ready' : 'attention'
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <span className={cx('shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold', toneClasses(tone))}>
          {available ? 'Bereit' : 'Fehlt'}
        </span>
      </div>
      {version && <p className="mt-2 truncate text-[11px] text-slate-600">{version}</p>}
    </div>
  )
}

function CapabilityPill({
  label,
  ready,
}: {
  label: string
  ready: boolean
}) {
  const tone: Tone = ready ? 'ready' : 'attention'
  return (
    <span className={cx('inline-flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold', toneClasses(tone))}>
      <span>{label}</span>
      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
    </span>
  )
}

function StatusCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  tone: Tone
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className={cx('inline-flex rounded-lg border p-2', toneClasses(tone))}>{icon}</span>
        <span className={cx('rounded-full border px-2 py-1 text-[11px] font-semibold', toneClasses(tone))}>
          {statusLabel(tone)}
        </span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  )
}
