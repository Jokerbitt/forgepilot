'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AIStatus } from '@/app/api/ai/status/route'
import type { ConnectorHealth } from '@/lib/connectors/types'
import type { SmokeTestResult } from '@/app/api/smoke-test/route'
import type { StorageStatus } from '@/lib/storage/cutover-config'
import { cx } from '@/components/ui/primitives'

interface ConnectorHealthResponse {
  connectors: Array<{ manifest: { id: string; name: string }; health: ConnectorHealth }>
}

interface CliStatusResponse {
  zeroKeyReady: boolean
  activeMode: 'claude-cli' | 'codex-cli' | 'claude-api' | 'openai-api' | 'simulation'
  claudeCliAvailable: boolean
  claudeCliVersion: string | null
  codexCliAvailable: boolean
  codexCliVersion: string | null
  apiKeysOptional: boolean
  recommendation: string
}

interface StorageStatusResponse extends StorageStatus {
  inventory?: unknown
}

type Readiness = 'ok' | 'warn' | 'error' | 'loading'

interface SystemCard {
  id: string
  label: string
  icon: string
  status: Readiness
  detail: string
  hint?: string
  hintHref?: string
}

const CLI_MODE_LABEL: Record<CliStatusResponse['activeMode'], string> = {
  'claude-cli': 'Claude CLI (Zero-Key)',
  'codex-cli': 'Codex CLI (Zero-Key)',
  'claude-api': 'Claude API-Key',
  'openai-api': 'OpenAI API-Key',
  simulation: 'Simulation (keine Ausführung)',
}

const ACTION_PRIORITY = ['devserver', 'runner', 'ai', 'github', 'storage', 'smoke', 'linear', 'ollama']

export function computeNextAction(cards: SystemCard[]): { label: string; href?: string } | null {
  const byId = new Map(cards.map(c => [c.id, c]))
  for (const id of ACTION_PRIORITY) {
    const card = byId.get(id)
    if (!card) continue
    if (card.status === 'error' || card.status === 'warn') {
      if (card.hint) return { label: `${card.label}: ${card.hint}`, href: card.hintHref }
    }
  }
  return null
}

function StatusIcon({ status }: { status: Readiness }) {
  if (status === 'loading') return <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-600 border-t-transparent animate-spin" />
  if (status === 'ok') return <span className="text-emerald-400 font-bold text-sm">✓</span>
  if (status === 'warn') return <span className="text-amber-400 font-bold text-sm">!</span>
  return <span className="text-red-400 font-bold text-sm">✗</span>
}

function statusColor(status: Readiness): string {
  if (status === 'ok') return 'border-emerald-500/20 bg-emerald-500/[0.04]'
  if (status === 'warn') return 'border-amber-500/20 bg-amber-500/[0.04]'
  if (status === 'error') return 'border-red-500/20 bg-red-500/[0.04]'
  return 'border-white/[0.07] bg-white/[0.02]'
}

function SystemCardView({ card }: { card: SystemCard }) {
  return (
    <div className={cx('rounded-lg border px-3 py-2.5 flex items-start gap-3', statusColor(card.status))}>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.04] text-base">
        {card.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200 truncate">{card.label}</span>
          <StatusIcon status={card.status} />
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500 truncate">{card.detail}</p>
        {card.hint && card.status !== 'ok' && (
          card.hintHref ? (
            <Link href={card.hintHref} className="mt-1 text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors">
              {card.hint} →
            </Link>
          ) : (
            <p className="mt-1 text-[10px] text-slate-600">{card.hint}</p>
          )
        )}
      </div>
    </div>
  )
}

export function SystemReadinessPanel() {
  const [cards, setCards] = useState<SystemCard[]>([
    { id: 'devserver', label: 'Dev Server', icon: '◐', status: 'loading', detail: 'Prüfe lokale App…' },
    { id: 'runner', label: 'Runner', icon: '▶', status: 'loading', detail: 'Prüfe Ausführungsmodus…' },
    { id: 'storage', label: 'Storage', icon: '⛁', status: 'loading', detail: 'Prüfe Persistenz…' },
    { id: 'github', label: 'GitHub', icon: '⎇', status: 'loading', detail: 'Prüfe Verbindung…' },
    { id: 'linear', label: 'Linear', icon: '▲', status: 'loading', detail: 'Prüfe Verbindung…' },
    { id: 'ai', label: 'AI Provider', icon: '⚡', status: 'loading', detail: 'Prüfe Verfügbarkeit…' },
    { id: 'ollama', label: 'Ollama (lokal)', icon: '🖥', status: 'loading', detail: 'Prüfe lokalen Server…' },
    { id: 'smoke', label: 'Smoke Test', icon: '🔬', status: 'loading', detail: 'Prüfe Systemgesundheit…' },
  ])
  const [nextAction, setNextAction] = useState<{ label: string; href?: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      const [connRes, aiRes, smokeRes, cliRes, storageRes] = await Promise.allSettled([
        fetch('/api/connectors/health'),
        fetch('/api/ai/status'),
        fetch('/api/smoke-test'),
        fetch('/api/system/cli-status'),
        fetch('/api/storage-status'),
      ])

      const updated: SystemCard[] = []

      // ── Dev Server ────────────────────────────────────────────────────────────
      // Wenn dieser Panel überhaupt rendert läuft Next.js — wir verifizieren
      // zusätzlich, dass mindestens eine API-Route erreichbar war.
      const anyApiReachable = [connRes, aiRes, smokeRes, cliRes, storageRes].some(
        r => r.status === 'fulfilled' && r.value.ok,
      )

      updated.push({
        id: 'devserver',
        label: 'Dev Server',
        icon: '◐',
        status: anyApiReachable ? 'ok' : 'error',
        detail: anyApiReachable
          ? `Next.js läuft · API erreichbar`
          : 'Keine API-Route antwortet — Dev-Server prüfen',
        hint: anyApiReachable ? undefined : 'npm run dev neu starten',
      })

      // ── Runner (CLI / API / Simulation) ───────────────────────────────────────
      let cliStatus: CliStatusResponse | undefined
      if (cliRes.status === 'fulfilled' && cliRes.value.ok) {
        try { cliStatus = await cliRes.value.json() as CliStatusResponse } catch { /* ignore */ }
      }

      const runnerReady = cliStatus?.zeroKeyReady === true
      const runnerSimulating = cliStatus?.activeMode === 'simulation'
      updated.push({
        id: 'runner',
        label: 'Runner',
        icon: '▶',
        status: runnerReady ? 'ok' : runnerSimulating ? 'error' : cliStatus ? 'warn' : 'warn',
        detail: cliStatus
          ? CLI_MODE_LABEL[cliStatus.activeMode]
          : 'Runner-Status nicht verfügbar',
        hint: runnerReady
          ? undefined
          : runnerSimulating
            ? 'Claude oder Codex CLI installieren & einloggen'
            : 'Runner konfigurieren',
        hintHref: !runnerReady ? '/settings#api-keys' : undefined,
      })

      // ── Storage (PostgreSQL / JSON) ───────────────────────────────────────────
      let storage: StorageStatusResponse | undefined
      if (storageRes.status === 'fulfilled' && storageRes.value.ok) {
        try { storage = await storageRes.value.json() as StorageStatusResponse } catch { /* ignore */ }
      }

      const storageMode = storage?.mode
      const storageOk = storageMode === 'postgres' && storage?.postgresConfigured === true
      const storageBlocking = storageMode === 'postgres' && storage?.postgresConfigured === false
      updated.push({
        id: 'storage',
        label: 'Storage',
        icon: '⛁',
        status: storageOk ? 'ok' : storageBlocking ? 'error' : storage ? 'warn' : 'warn',
        detail: storage
          ? storageMode === 'postgres' && storage.postgresConfigured
            ? 'PostgreSQL aktiv · production-ready'
            : storageMode === 'dual'
              ? `Dual-Write · ${storage.postgresConfigured ? 'PG verbunden' : 'PG fehlt → fällt auf JSON'}`
              : storageMode === 'json'
                ? 'JSON-Dateien · nur Dev/Bootstrap'
                : storage.recommendation
          : 'Storage-Status nicht verfügbar',
        hint: storageOk
          ? undefined
          : storage?.risks[0] ?? storage?.recommendation ?? 'STORAGE_MODE prüfen',
        hintHref: !storageOk ? '/settings#storage' : undefined,
      })

      // ── Connectors ────────────────────────────────────────────────────────────
      let githubHealth: ConnectorHealth | undefined
      let linearHealth: ConnectorHealth | undefined

      if (connRes.status === 'fulfilled' && connRes.value.ok) {
        const data = await connRes.value.json() as ConnectorHealthResponse
        githubHealth = data.connectors.find(c => c.manifest.id === 'github')?.health
        linearHealth = data.connectors.find(c => c.manifest.id === 'linear')?.health
      }

      updated.push({
        id: 'github',
        label: 'GitHub',
        icon: '⎇',
        status: githubHealth?.status === 'ok' ? 'ok'
          : githubHealth?.status === 'unconfigured' ? 'error'
          : githubHealth?.status === 'degraded' ? 'warn'
          : githubHealth ? 'error'
          : 'error',
        detail: githubHealth?.status === 'ok'
          ? `Verbunden · ${githubHealth.latencyMs ?? 0}ms`
          : githubHealth?.status === 'unconfigured'
          ? 'Kein GitHub Token konfiguriert'
          : githubHealth?.errorMessage ?? 'Nicht erreichbar',
        hint: githubHealth?.status !== 'ok' ? 'GitHub Token in API Keys eintragen' : undefined,
        hintHref: githubHealth?.status !== 'ok' ? '/settings#api-keys' : undefined,
      })

      updated.push({
        id: 'linear',
        label: 'Linear',
        icon: '▲',
        status: linearHealth?.status === 'ok' ? 'ok'
          : linearHealth?.status === 'unconfigured' ? 'warn'
          : linearHealth?.status === 'degraded' ? 'warn'
          : linearHealth ? 'error'
          : 'warn',
        detail: linearHealth?.status === 'ok'
          ? `Verbunden · ${linearHealth.latencyMs ?? 0}ms`
          : linearHealth?.status === 'unconfigured'
          ? 'Optional: kein Linear Key gesetzt'
          : linearHealth?.errorMessage ?? 'Nicht erreichbar',
        hint: linearHealth?.status === 'unconfigured' ? 'Linear API Key hinzufügen für Ticket-Sync' : undefined,
        hintHref: linearHealth?.status === 'unconfigured' ? '/settings#api-keys' : undefined,
      })

      // ── AI Provider ───────────────────────────────────────────────────────────
      let aiStatus: AIStatus | undefined
      if (aiRes.status === 'fulfilled' && aiRes.value.ok) {
        aiStatus = await aiRes.value.json() as AIStatus
      }

      const resolved = aiStatus?.resolvedProvider
      const hasWorkingProvider = resolved && resolved.providerId !== 'placeholder'

      updated.push({
        id: 'ai',
        label: 'AI Provider',
        icon: '⚡',
        status: hasWorkingProvider ? 'ok' : aiStatus ? 'error' : 'error',
        detail: hasWorkingProvider
          ? `${resolved.providerId} · ${resolved.model ?? '—'}`
          : aiStatus?.recommendation ?? 'Kein Provider konfiguriert',
        hint: !hasWorkingProvider ? 'Provider konfigurieren' : undefined,
        hintHref: !hasWorkingProvider ? '/settings#ai-provider' : undefined,
      })

      // ── Ollama ────────────────────────────────────────────────────────────────
      const ollamaRunning = aiStatus?.ollamaRunning ?? false
      const ollamaModels = aiStatus?.ollamaModels ?? []

      updated.push({
        id: 'ollama',
        label: 'Ollama (lokal)',
        icon: '🖥',
        status: ollamaRunning ? 'ok' : 'warn',
        detail: ollamaRunning
          ? `${ollamaModels.length} Modell${ollamaModels.length !== 1 ? 'e' : ''} geladen`
          : 'Server nicht erreichbar (optional)',
        hint: !ollamaRunning ? 'ollama serve starten für lokale Ausführung' : undefined,
      })

      // ── Smoke Test ────────────────────────────────────────────────────────────
      let smokeResult: SmokeTestResult | undefined
      if (smokeRes.status === 'fulfilled') {
        try { smokeResult = await smokeRes.value.json() as SmokeTestResult } catch { /* ignore */ }
      }

      updated.push({
        id: 'smoke',
        label: 'Smoke Test',
        icon: '🔬',
        status: smokeResult?.ok ? 'ok' : smokeResult ? 'error' : 'warn',
        detail: smokeResult?.summary ?? 'Nicht erreichbar',
        hint: smokeResult && !smokeResult.ok ? 'API-Endpoint prüfen' : undefined,
      })

      setCards(updated)
      setNextAction(computeNextAction(updated))
    }

    void load()
  }, [])

  const anyError = cards.some(c => c.status === 'error')
  const anyWarn = cards.some(c => c.status === 'warn')
  const allOk = cards.every(c => c.status === 'ok' || c.status === 'loading')

  return (
    <div className={cx(
      'rounded-xl border p-4',
      anyError ? 'border-red-500/20 bg-red-500/[0.03]'
        : anyWarn ? 'border-amber-500/20 bg-amber-500/[0.03]'
        : 'border-emerald-500/20 bg-emerald-500/[0.03]'
    )}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cx(
            'flex h-2 w-2 rounded-full',
            anyError ? 'bg-red-400' : anyWarn ? 'bg-amber-400 animate-pulse' : allOk ? 'bg-emerald-400' : 'bg-slate-500'
          )} />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            System Readiness
          </p>
        </div>
        <span className={cx(
          'text-xs font-medium',
          anyError ? 'text-red-400' : anyWarn ? 'text-amber-400' : 'text-emerald-400'
        )}>
          {anyError ? 'Aktion erforderlich' : anyWarn ? 'Optionale Verbindungen fehlen' : 'Alle Systeme verbunden'}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {cards.map(card => (
          <SystemCardView key={card.id} card={card} />
        ))}
      </div>
      {nextAction && (
        <div
          data-testid="system-readiness-next-action"
          className={cx(
            'mt-3 rounded-lg border px-3 py-2 text-xs',
            anyError
              ? 'border-red-500/30 bg-red-500/[0.06] text-red-200'
              : 'border-amber-500/30 bg-amber-500/[0.06] text-amber-200',
          )}
        >
          <span className="font-semibold uppercase tracking-wide mr-2">Nächste sichere Aktion:</span>
          {nextAction.href ? (
            <Link href={nextAction.href} className="underline underline-offset-2 hover:text-white">
              {nextAction.label} →
            </Link>
          ) : (
            <span>{nextAction.label}</span>
          )}
        </div>
      )}
    </div>
  )
}
