'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { OperatorReadiness, ReadinessStatus } from '@/lib/operator/readiness'

const STATUS_STYLE: Record<ReadinessStatus, string> = {
  ready: 'border-green-800/70 bg-green-950/20 text-green-300',
  attention: 'border-yellow-800/70 bg-yellow-950/20 text-yellow-300',
  blocked: 'border-red-800/70 bg-red-950/20 text-red-300',
}

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  ready: 'bereit',
  attention: 'pruefen',
  blocked: 'blockiert',
}

export function OperatorReadinessPanel() {
  const [readiness, setReadiness] = useState<OperatorReadiness | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/operator/readiness')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json() as OperatorReadiness
        if (!cancelled) setReadiness(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Readiness konnte nicht geladen werden.')
      }
    }

    load()
    const interval = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (error) {
    return (
      <section className="mb-6 rounded-lg border border-red-900/70 bg-red-950/20 p-4 text-sm text-red-300">
        Operator-Status konnte nicht geladen werden: {error}
      </section>
    )
  }

  if (!readiness) {
    return (
      <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-800" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="h-20 animate-pulse rounded bg-gray-800/70" />
          <div className="h-20 animate-pulse rounded bg-gray-800/70" />
          <div className="h-20 animate-pulse rounded bg-gray-800/70" />
        </div>
      </section>
    )
  }

  const primaryAction = readiness.nextActions[0]

  return (
    <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Operator Cockpit</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[readiness.status]}`}>
              {STATUS_LABEL[readiness.status]} - {readiness.score}%
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Heute produktiv: Intake, Research, Delegation und Autopilot auf einen Blick.
          </p>
        </div>

        {primaryAction?.actionHref && (
          <Link
            href={primaryAction.actionHref}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            {primaryAction.actionLabel ?? 'Naechsten Schritt oeffnen'}
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Aktive Briefs" value={readiness.metrics.activeBriefs} />
        <Metric label="Research offen" value={readiness.metrics.briefsNeedingResearch} />
        <Metric label="Wartende Delegationen" value={readiness.metrics.pendingDelegations + readiness.metrics.approvedDelegations} />
        <Metric label="Fehler" value={readiness.metrics.failedDelegations} tone={readiness.metrics.failedDelegations > 0 ? 'bad' : 'neutral'} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Systemchecks</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {readiness.checks.map(check => (
              <div key={check.id} className="rounded-md border border-gray-800 bg-gray-900/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-200">{check.label}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLE[check.status]}`}>
                    {STATUS_LABEL[check.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Naechste Aktionen</h3>
          <div className="mt-3 space-y-2">
            {readiness.nextActions.length === 0 ? (
              <p className="rounded-md border border-green-900/50 bg-green-950/20 p-3 text-sm text-green-300">
                Alles bereit. Lege ein Linear-Testticket an und pruefe den End-to-End-Loop.
              </p>
            ) : (
              readiness.nextActions.map(action => (
                <div key={action.id} className="rounded-md border border-gray-800 bg-gray-900/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-200">{action.label}</span>
                    {action.actionHref && (
                      <Link href={action.actionHref} className="text-xs text-blue-400 hover:text-blue-300">
                        {action.actionLabel ?? 'oeffnen'}
                      </Link>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{action.detail}</p>
                </div>
              ))
            )}
          </div>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">n8n Workflows</h3>
          <div className="mt-2 space-y-1.5">
            {readiness.workflows.map(workflow => (
              <div key={workflow.id} className="flex items-center justify-between rounded border border-gray-800 px-2 py-1.5 text-xs">
                <span className="text-gray-300">{workflow.label}</span>
                <span className={workflow.exists && workflow.active !== false ? 'text-green-400' : workflow.exists ? 'text-yellow-400' : 'text-red-400'}>
                  {!workflow.exists ? 'fehlt' : workflow.active === false ? 'deaktiviert' : 'vorhanden'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'bad' }) {
  return (
    <div className={`rounded-md border p-3 ${tone === 'bad' ? 'border-red-900/60 bg-red-950/20' : 'border-gray-800 bg-gray-950/70'}`}>
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
    </div>
  )
}
