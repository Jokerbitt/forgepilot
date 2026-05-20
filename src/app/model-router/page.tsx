'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RoutingDecision } from '@/lib/models/model-router'
import { Badge, EmptyState, StatusDot, buttonClassName, cx } from '@/components/ui/primitives'
import { DEFAULT_PROFILES } from '@/lib/model-router/profiles'
import type { ModelProfile } from '@/lib/models/model-router'

type Tab = 'profiles' | 'decisions'
type Tone = 'neutral' | 'good' | 'warn' | 'danger'

function costColor(c: string): string {
  if (c === 'free-local') return 'text-emerald-300'
  if (c === 'included-subscription') return 'text-sky-300'
  if (c === 'metered-low') return 'text-amber-300'
  return 'text-rose-300'
}

function costLabel(c: string): string {
  if (c === 'free-local') return 'Kostenlos lokal'
  if (c === 'included-subscription') return 'Abo inklusive'
  if (c === 'metered-low') return 'Gering'
  if (c === 'metered-high') return 'Hoch'
  return c
}

function healthTone(h: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (h === 'healthy') return 'success'
  if (h === 'degraded') return 'warning'
  if (h === 'offline') return 'danger'
  return 'neutral'
}

function modeLabel(m: string): string {
  if (m === 'local') return 'Lokal'
  if (m === 'desktop-agent') return 'Desktop Agent'
  if (m === 'cloud') return 'Cloud'
  return m
}

function modeTone(m: string): 'success' | 'info' | 'privacy' | 'neutral' {
  if (m === 'local') return 'success'
  if (m === 'desktop-agent') return 'info'
  if (m === 'cloud') return 'privacy'
  return 'neutral'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ModelRouterPage() {
  const [tab, setTab] = useState<Tab>('profiles')
  const [decisions, setDecisions] = useState<RoutingDecision[]>([])
  const [loading, setLoading] = useState(false)
  const profiles: ModelProfile[] = DEFAULT_PROFILES

  const stats = useMemo(() => {
    const healthy = profiles.filter(p => p.healthStatus === 'healthy').length
    const local = profiles.filter(p => p.executionMode === 'local').length
    const cloud = profiles.filter(p => p.executionMode === 'cloud').length
    const guarded = profiles.filter(p => p.costClass === 'metered-high' || p.executionMode === 'cloud').length
    return { healthy, local, cloud, guarded }
  }, [profiles])

  useEffect(() => {
    if (tab !== 'decisions') return
    setLoading(true)
    fetch('/api/model-router')
      .then(r => r.json())
      .then((d: RoutingDecision[]) => setDecisions(Array.isArray(d) ? d.slice().reverse() : []))
      .catch(() => setDecisions([]))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-slate-800 pb-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">System Control Plane</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Model Router</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                ForgePilot entscheidet hier, welche KI für welche Arbeit sinnvoll ist: lokal für Routine,
                Abo-Agenten für produktive Entwicklung und Cloud nur bei hoher Komplexität oder bewusster Freigabe.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Routing-Policy</p>
              <p className="mt-2 text-base font-semibold text-white">Local-first, Kosten bewusst, Risiko kontrolliert</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Secrets, RiskClass C und teure Cloud-Routen bleiben manuell prüfpflichtig.
              </p>
            </div>
          </div>
        </header>

        <section className="my-6 grid gap-3 md:grid-cols-4">
          <RouterMetric label="Readiness" value={`${stats.healthy}/${profiles.length}`} detail="Provider einsatzbereit" tone={stats.healthy === profiles.length ? 'good' : 'warn'} />
          <RouterMetric label="Local-first" value={stats.local} detail="lokale Modelle" tone="good" />
          <RouterMetric label="Cloud" value={stats.cloud} detail="komplexe Routen" />
          <RouterMetric label="Guardrails" value={stats.guarded} detail="kosten-/risikosensitiv" tone="warn" />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40">
            <SectionHeader
              eyebrow="Entscheidungslogik"
              title="Welche Modelle wofür eingesetzt werden"
              description="Die Tabelle ist bewusst operativ: Sie zeigt, was automatisch laufen darf und wo Sven bewusst entscheiden sollte."
            />
            <div className="grid gap-px overflow-hidden rounded-b-lg border-t border-slate-800 bg-slate-800 md:grid-cols-3">
              <RoutingLane
                title="Lokal"
                badge="Standard"
                tone="local"
                body="Zusammenfassen, klassifizieren, Kontext komprimieren, Embeddings, einfache Checks."
                decision="Automatisch möglich"
              />
              <RoutingLane
                title="Abo-Agent"
                badge="Produktiv"
                tone="agent"
                body="Implementierung, Refactoring, Review, Debugging und strukturierte Planung."
                decision="Nach Task Contract"
              />
              <RoutingLane
                title="Cloud"
                badge="Premium"
                tone="cloud"
                body="Architektur, schwierige Fehlerbilder, Sicherheitsanalyse und komplexe Produktentscheidungen."
                decision="Nur bei Bedarf"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40">
            <SectionHeader
              eyebrow="Betriebsmodell"
              title="Alltagsregel für Sven"
              description="Kleine lokale Modelle sparen Kosten und halten Routinearbeit schnell. Starke Agenten bleiben für Hebel-Aufgaben reserviert."
            />
            <div className="space-y-3 border-t border-slate-800 p-4">
              <PolicyRow label="Routine" value="Ollama / LM Studio" tone="good" />
              <PolicyRow label="Coding" value="Codex, Claude Code, Cursor oder Antigravity" />
              <PolicyRow label="High Risk" value="Manuelle Freigabe" tone="warn" />
              <PolicyRow label="Secrets" value="Nicht in Knowledge importieren" tone="danger" />
            </div>
          </div>
        </section>

        <div className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            {(['profiles', 'decisions'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cx(
                  'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                  tab === t ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                {t === 'profiles' ? `Provider (${profiles.length})` : `Routing-Log (${decisions.length})`}
              </button>
            ))}
          </div>
          <Link href="/settings" className={buttonClassName('secondary', 'w-full sm:w-auto')}>
            Routing einstellen
          </Link>
        </div>

        {tab === 'profiles' ? (
          <ProviderTable profiles={profiles} />
        ) : loading ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-500">Lade Routing-Log...</p>
        ) : decisions.length === 0 ? (
          <EmptyState
            title="Noch keine Routing-Entscheidungen"
            description="Entscheidungen werden automatisch beim Start von Delegationen gespeichert."
          />
        ) : (
          <RoutingLog decisions={decisions} />
        )}
      </div>
    </main>
  )
}

function ProviderTable({ profiles }: { profiles: ModelProfile[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
      <div className="hidden grid-cols-[1.2fr_0.7fr_0.8fr_1.5fr_1fr] gap-4 border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
        <span>Provider</span>
        <span>Status</span>
        <span>Kosten</span>
        <span>Beste Aufgaben</span>
        <span>Privacy</span>
      </div>
      <div className="divide-y divide-slate-800">
        {profiles.map(p => (
          <div key={p.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1.2fr_0.7fr_0.8fr_1.5fr_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <StatusDot tone={healthTone(p.healthStatus)} />
                <p className="text-sm font-semibold text-white">{p.modelName}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={modeTone(p.executionMode)}>{modeLabel(p.executionMode)}</Badge>
                <span className="text-xs text-slate-500">{p.provider}</span>
              </div>
            </div>
            <MobileLabel label="Status">
              <span className="text-sm capitalize text-slate-300">{p.healthStatus}</span>
            </MobileLabel>
            <MobileLabel label="Kosten">
              <span className={cx('text-sm font-semibold', costColor(p.costClass))}>{costLabel(p.costClass)}</span>
            </MobileLabel>
            <MobileLabel label="Beste Aufgaben">
              <div className="flex flex-wrap gap-1.5">
                {p.recommendedWorkloads.slice(0, 5).map(w => (
                  <Badge key={w}>{w}</Badge>
                ))}
              </div>
            </MobileLabel>
            <MobileLabel label="Privacy">
              <div className="flex flex-wrap gap-1.5">
                {p.privacyModes.map(m => (
                  <span
                    key={m}
                    className={cx(
                      'rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                      m === 'local-only' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
                      m === 'hybrid' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' :
                      'border-sky-500/30 bg-sky-500/10 text-sky-300'
                    )}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </MobileLabel>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoutingLog({ decisions }: { decisions: RoutingDecision[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Modell</th>
            <th className="px-4 py-3">Workload</th>
            <th className="hidden px-4 py-3 sm:table-cell">Privacy</th>
            <th className="hidden px-4 py-3 md:table-cell">Grund</th>
            <th className="px-4 py-3">Zeit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {decisions.map(d => (
            <tr key={d.id} className="hover:bg-slate-800/30">
              <td className="px-4 py-3 font-mono text-xs text-white">{d.selectedModel}</td>
              <td className="px-4 py-3"><Badge>{d.workload}</Badge></td>
              <td className="hidden px-4 py-3 text-xs text-slate-400 sm:table-cell">{d.privacyMode}</td>
              <td className="hidden max-w-xs px-4 py-3 text-xs text-slate-500 md:table-cell">
                <span className="line-clamp-1">{d.reason}</span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">{formatDate(d.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RouterMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  detail: string
  tone?: Tone
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx(
        'mt-2 text-2xl font-semibold',
        tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'danger' ? 'text-rose-300' : 'text-white'
      )}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
      <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function RoutingLane({
  title,
  badge,
  body,
  decision,
  tone,
}: {
  title: string
  badge: string
  body: string
  decision: string
  tone: 'local' | 'agent' | 'cloud'
}) {
  const tones = {
    local: 'text-emerald-300',
    agent: 'text-sky-300',
    cloud: 'text-violet-300',
  }

  return (
    <div className="bg-slate-950/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={cx('text-sm font-semibold', tones[tone])}>{title}</p>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {badge}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{decision}</p>
    </div>
  )
}

function PolicyRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={cx(
        'text-right text-sm font-semibold',
        tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'danger' ? 'text-rose-300' : 'text-white'
      )}>
        {value}
      </span>
    </div>
  )
}

function MobileLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 lg:hidden">{label}</p>
      {children}
    </div>
  )
}
