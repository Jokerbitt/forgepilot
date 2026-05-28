'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
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

const previewPages = [
  {
    label: 'Command Center',
    href: '/',
    description: 'Startpunkt: Idee eingeben, Plan Mode starten, nächste Empfehlung sehen.',
  },
  {
    label: 'Plan Mode',
    href: '/idea',
    description: 'Aus einer Idee wird ein Produktplan mit Arbeitspaketen.',
  },
  {
    label: 'Ausführen',
    href: '/delegations',
    description: 'Delegations prüfen, freigeben, starten und Ergebnisse kontrollieren.',
  },
  {
    label: 'ToDo Demo',
    href: '/demo/todo-planner',
    description: 'Die erste testbare Demo-App aus dem ForgePilot-Run.',
  },
  {
    label: 'Branches',
    href: '/branches',
    description: 'Pull Requests prüfen, Änderungen ansehen und sicher in main mergen.',
  },
  {
    label: 'Wissen',
    href: '/knowledge',
    description: 'Gespeicherte Erkenntnisse und Writebacks ansehen.',
  },
  {
    label: 'Settings',
    href: '/settings',
    description: 'Provider, lokale Modelle, GitHub, Linear und Betrieb prüfen.',
  },
]

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

function statusIcon(tone: Tone) {
  if (tone === 'ready') return <CheckCircle2 className="h-4 w-4" />
  if (tone === 'attention') return <AlertTriangle className="h-4 w-4" />
  if (tone === 'blocked') return <AlertTriangle className="h-4 w-4" />
  return <Activity className="h-4 w-4" />
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
  const [selectedPath, setSelectedPath] = useState('/')
  const [loading, setLoading] = useState(true)
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [delegations, setDelegations] = useState<DelegationStatsResponse | null>(null)
  const [storage, setStorage] = useState<StorageStatusResponse | null>(null)
  const [executeHealth, setExecuteHealth] = useState<ExecuteHealthResponse | null>(null)
  const [cliStatus, setCliStatus] = useState<CliStatusResponse | null>(null)
  const [dailyReport, setDailyReport] = useState<DailyReportResponse | null>(null)
  const [autopilotReadiness, setAutopilotReadiness] = useState<AutopilotReadinessResponse | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)
  const [demoRun, setDemoRun] = useState<DemoRunResponse | null>(null)
  const [demoRunLoading, setDemoRunLoading] = useState(false)
  const [runnerPr, setRunnerPr] = useState<RunnerPrResponse | null>(null)
  const [runnerPrLoading, setRunnerPrLoading] = useState(false)
  const [endpoints, setEndpoints] = useState<EndpointState[]>([])

  const refresh = async () => {
    setLoading(true)
    const [healthRes, statsRes, storageRes, executeRes, cliRes, reportRes, autopilotRes] = await Promise.all([
      fetchJson<{ status?: string }>('/api/health'),
      fetchJson<DelegationStatsResponse>('/api/delegations/stats'),
      fetchJson<StorageStatusResponse>('/api/storage-status'),
      fetchJson<ExecuteHealthResponse>('/api/execute-loop/health'),
      fetchJson<CliStatusResponse>('/api/system/cli-status'),
      fetchJson<DailyReportResponse>('/api/reports/daily', 8000),
      fetchJson<AutopilotReadinessResponse>('/api/autopilot/readiness', 8000),
    ])

    if (statsRes.ok) setDelegations(statsRes.data)
    if (storageRes.ok) setStorage(storageRes.data)
    if (executeRes.ok) setExecuteHealth(executeRes.data)
    if (cliRes.ok) setCliStatus(cliRes.data)
    if (reportRes.ok) setDailyReport(reportRes.data)
    if (autopilotRes.ok) setAutopilotReadiness(autopilotRes.data)

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
  const previewUrl = selectedPath
  const zeroKeyLabel = cliStatus?.activeMode === 'claude-cli'
    ? 'Claude Max bereit'
    : cliStatus?.activeMode === 'codex-cli'
      ? 'Codex CLI bereit'
      : cliStatus?.zeroKeyReady
        ? 'CLI bereit'
        : 'CLI prüfen'
  const autopilotTone = autopilotReadiness?.status ?? 'attention'
  const runnerPrBlocked = autopilotReadiness ? !autopilotReadiness.canExecuteCode : false

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
                    setSelectedPath(data.appPreviewHref ?? '/demo/todo-planner')
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

        <section className="grid min-h-[720px] gap-5 xl:grid-cols-[380px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">Testbare Kernseiten</h2>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  {lastCheckedAt ?? 'lädt'}
                </span>
              </div>
              <div className="space-y-2">
                {previewPages.map(page => (
                  <button
                    key={page.href}
                    type="button"
                    onClick={() => setSelectedPath(page.href)}
                    className={cx(
                      'w-full rounded-lg border px-3 py-3 text-left transition',
                      selectedPath === page.href
                        ? 'border-violet-500/40 bg-violet-500/[0.12]'
                        : 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.045]'
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-100">{page.label}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{page.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">Live Checks</h2>
              <div className="space-y-2">
                {endpoints.map(endpoint => (
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
                <p className="truncate text-sm font-semibold text-white">{previewUrl}</p>
              </div>
              <Link
                href={previewUrl}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-500/30 hover:bg-violet-500/10"
              >
                Seite öffnen
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <iframe
              key={previewUrl}
              title="ForgePilot Live Preview"
              src={previewUrl}
              className="h-[720px] w-full bg-[#08080d]"
            />
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
