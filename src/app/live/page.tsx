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
  RefreshCw,
  Route,
  Shield,
} from 'lucide-react'
import { LiveAgentActivityPanel } from '@/components/live/LiveAgentActivityPanel'
import { cx } from '@/components/ui/primitives'

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
  checks?: Record<string, { ok: boolean; detail: string }>
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
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(href, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    return { ok: true, data: await res.json() as T }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, detail: `Timeout nach ${Math.round(timeoutMs / 1000)}s` }
    }
    return { ok: false, detail: error instanceof Error ? error.message : 'Nicht erreichbar' }
  } finally {
    window.clearTimeout(timeout)
  }
}

export default function LiveViewPage() {
  const [selectedPath, setSelectedPath] = useState('/')
  const [loading, setLoading] = useState(true)
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [delegations, setDelegations] = useState<DelegationStatsResponse | null>(null)
  const [storage, setStorage] = useState<StorageStatusResponse | null>(null)
  const [executeHealth, setExecuteHealth] = useState<ExecuteHealthResponse | null>(null)
  const [dailyReport, setDailyReport] = useState<DailyReportResponse | null>(null)
  const [endpoints, setEndpoints] = useState<EndpointState[]>([])

  const refresh = async () => {
    setLoading(true)
    const [healthRes, statsRes, storageRes, executeRes, reportRes] = await Promise.all([
      fetchJson<{ status?: string }>('/api/health'),
      fetchJson<DelegationStatsResponse>('/api/delegations/stats'),
      fetchJson<StorageStatusResponse>('/api/storage-status'),
      fetchJson<ExecuteHealthResponse>('/api/execute-loop/health'),
      fetchJson<DailyReportResponse>('/api/reports/daily', 8000),
    ])

    if (statsRes.ok) setDelegations(statsRes.data)
    if (storageRes.ok) setStorage(storageRes.data)
    if (executeRes.ok) setExecuteHealth(executeRes.data)
    if (reportRes.ok) setDailyReport(reportRes.data)

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
            label="Betrieb"
            value={storage?.mode ?? dailyReport?.status?.operations?.storageMode ?? 'unbekannt'}
            detail={dailyReport?.status?.operations?.authDisabled ? 'Login ist lokal deaktiviert.' : 'Login aktiv.'}
            tone={dailyReport?.status?.operations?.authDisabled ? 'attention' : 'ready'}
          />
        </section>

        <LiveAgentActivityPanel />

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
