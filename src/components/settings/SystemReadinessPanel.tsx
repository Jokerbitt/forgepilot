'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AIStatus } from '@/app/api/ai/status/route'
import type { ConnectorHealth } from '@/lib/connectors/types'
import type { SmokeTestResult } from '@/app/api/smoke-test/route'
import { cx } from '@/components/ui/primitives'

interface ConnectorHealthResponse {
  connectors: Array<{ manifest: { id: string; name: string }; health: ConnectorHealth }>
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
    { id: 'github', label: 'GitHub', icon: '⎇', status: 'loading', detail: 'Prüfe Verbindung…' },
    { id: 'linear', label: 'Linear', icon: '▲', status: 'loading', detail: 'Prüfe Verbindung…' },
    { id: 'ai', label: 'AI Provider', icon: '⚡', status: 'loading', detail: 'Prüfe Verfügbarkeit…' },
    { id: 'ollama', label: 'Ollama (lokal)', icon: '🖥', status: 'loading', detail: 'Prüfe lokalen Server…' },
    { id: 'smoke', label: 'Smoke Test', icon: '🔬', status: 'loading', detail: 'Prüfe Systemgesundheit…' },
  ])

  useEffect(() => {
    const load = async () => {
      const [connRes, aiRes, smokeRes] = await Promise.allSettled([
        fetch('/api/connectors/health'),
        fetch('/api/ai/status'),
        fetch('/api/smoke-test'),
      ])

      const updated: SystemCard[] = []

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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(card => (
          <SystemCardView key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
