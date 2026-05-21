'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { Badge, Panel, StatusDot, buttonClassName, cx } from '@/components/ui/primitives'
import type { SaaSReadinessAudit, SaaSReadinessCheck } from '@/lib/saas-readiness/audit'

const categoryIcon = {
  auth: Lock,
  tenancy: Building2,
  billing: Banknote,
  privacy: ShieldCheck,
  market: Sparkles,
} satisfies Record<SaaSReadinessCheck['category'], React.ElementType>

const severityTone = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
} as const

const statusLabel = {
  ready: 'Bereit',
  partial: 'Teilweise',
  missing: 'Fehlt',
} satisfies Record<SaaSReadinessCheck['status'], string>

export default function SaaSReadinessPage() {
  const [audit, setAudit] = useState<SaaSReadinessAudit | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/saas-readiness')
      .then(res => res.json())
      .then((data: SaaSReadinessAudit) => setAudit(data))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => {
    if (!audit) return { ready: 0, partial: 0, missing: 0 }
    return audit.checks.reduce((acc, check) => {
      acc[check.status] += 1
      return acc
    }, { ready: 0, partial: 0, missing: 0 })
  }, [audit])

  return (
    <main className="min-h-screen bg-[#07070c] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Market readiness</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">SaaS Readiness Audit</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Ein kompakter Launch-Kompass fuer Auth, Tenant-Isolation, Billing, Datenschutz und Pricing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/deployment" className={buttonClassName('secondary')}>
              Deployment pruefen
            </Link>
            <Link href="/onboarding" className={buttonClassName('primary')}>
              Onboarding testen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {loading || !audit ? (
          <Panel className="p-6">
            <p className="text-sm text-slate-400">Audit wird geladen...</p>
          </Panel>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Panel className="p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusDot tone={audit.readiness === 'launch_candidate' ? 'success' : audit.readiness === 'blocked' ? 'danger' : 'warning'} pulse={audit.readiness === 'launch_candidate'} />
                      <p className="text-sm font-semibold text-slate-300">{readinessLabel(audit.readiness)}</p>
                    </div>
                    <p className="mt-2 text-5xl font-semibold tracking-tight text-white">{audit.score}</p>
                    <p className="mt-1 text-sm text-slate-500">von 100 Punkten</p>
                  </div>
                  <div className="grid min-w-72 grid-cols-3 gap-2">
                    <MiniStat label="Bereit" value={counts.ready} tone="success" />
                    <MiniStat label="Teilweise" value={counts.partial} tone="warning" />
                    <MiniStat label="Fehlt" value={counts.missing} tone="danger" />
                  </div>
                </div>
              </Panel>

              <Panel className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 text-amber-300" />
                  <h2 className="text-sm font-semibold text-white">Naechste Entscheidungen</h2>
                </div>
                <div className="space-y-3">
                  {audit.nextActions.map(action => (
                    <div key={action.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{action.title}</p>
                        <Badge tone={severityTone[action.severity]}>{action.severity}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{action.recommendation}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="grid gap-4 lg:grid-cols-5">
              {audit.checks.map(check => (
                <ReadinessCard key={check.id} check={check} />
              ))}
            </section>

            <Panel className="p-5">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-violet-300" />
                <h2 className="text-sm font-semibold text-white">Empfohlener Launch-Pfad</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <LaunchStep label="1" title="Single-User absichern" detail="Auth aktivieren, Admin-Credentials setzen, API-Grenze pruefen." />
                <LaunchStep label="2" title="Tenant-Feld einfuehren" detail="Neue Stores/APIs tenant-aware machen, bevor echte Teams kommen." />
                <LaunchStep label="3" title="Pricing validieren" detail="Solo/Team/Credits als Wireframe testen, erst danach Billing automatisieren." />
              </div>
            </Panel>
          </>
        )}
      </div>
    </main>
  )
}

function readinessLabel(readiness: SaaSReadinessAudit['readiness']) {
  if (readiness === 'launch_candidate') return 'Launch-Kandidat'
  if (readiness === 'at_risk') return 'Launch mit Risiko'
  return 'Launch blockiert'
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{label}</p>
        <StatusDot tone={tone} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function ReadinessCard({ check }: { check: SaaSReadinessCheck }) {
  const Icon = categoryIcon[check.category]

  return (
    <Panel className="p-4 lg:col-span-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300">
          <Icon className="h-4 w-4" />
        </div>
        <Badge tone={check.status === 'ready' ? 'success' : check.status === 'missing' ? 'danger' : 'warning'}>
          {statusLabel[check.status]}
        </Badge>
      </div>
      <h2 className="mt-4 text-sm font-semibold text-white">{check.title}</h2>
      <p className="mt-2 text-xs leading-5 text-slate-400">{check.summary}</p>
      <div className="mt-4 space-y-1.5">
        {check.evidence.map(item => (
          <div key={item} className="flex gap-2 text-xs text-slate-500">
            <CheckCircle2 className={cx('mt-0.5 h-3 w-3 shrink-0', check.status === 'ready' ? 'text-emerald-400' : 'text-slate-600')} />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs leading-5 text-slate-300">{check.recommendation}</p>
    </Panel>
  )
}

function LaunchStep({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/15 text-xs font-semibold text-violet-200">{label}</span>
        <BadgeCheck className="h-4 w-4 text-slate-500" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  )
}
