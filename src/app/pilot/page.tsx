'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PilotRunResult, PilotStep } from '@/lib/pilot/types'
import { cx } from '@/components/ui/primitives'

function stepTone(s: PilotStep['status']): 'success' | 'danger' | 'warning' | 'neutral' {
  if (s === 'ok') return 'success'
  if (s === 'error') return 'danger'
  if (s === 'skipped') return 'warning'
  return 'neutral'
}

function stepIcon(s: PilotStep['status']): string {
  if (s === 'ok') return '✓'
  if (s === 'error') return '✗'
  if (s === 'skipped') return '—'
  return '○'
}

function stepColor(s: PilotStep['status']): string {
  if (s === 'ok') return 'text-emerald-400'
  if (s === 'error') return 'text-red-400'
  if (s === 'skipped') return 'text-amber-400'
  return 'text-slate-500'
}

type PrivacyMode = 'local-only' | 'hybrid' | 'cloud-approved'
type RiskClass = 'A' | 'B' | 'C'

const AUTO_NAVIGATE_DELAY_MS = 4_000

export default function PilotPage() {
  const router = useRouter()
  const [workItemId, setWorkItemId] = useState('LOCAL-DEMO-001')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('hybrid')
  const [riskClass, setRiskClass] = useState<RiskClass>('A')
  const [maxBudget, setMaxBudget] = useState(2.0)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PilotRunResult | null>(null)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)

  // Auto-navigate to delegation when pilot creates one
  useEffect(() => {
    if (!result?.delegationId) return
    const total = Math.round(AUTO_NAVIGATE_DELAY_MS / 1000)
    setCountdown(total)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          router.push(`/delegations/${result.delegationId}`)
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [result?.delegationId, router])

  const handleRun = async () => {
    if (!workItemId.trim() || !title.trim() || !goal.trim()) {
      setError('WorkItem-ID, Titel und Ziel sind Pflichtfelder.')
      return
    }
    setError('')
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId, title, goal, privacyMode, riskClass, maxBudgetUsd: maxBudget }),
      })
      const data = await res.json() as PilotRunResult
      setResult(data)
    } catch {
      setError('Verbindungsfehler beim Pilot-Run.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl p-6">
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execute</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">E2E Pilot</h1>
          <p className="mt-2 text-sm text-slate-400">
            Vollständige Pipeline testen: Policy → Model Routing → Agent Selection → Run → Writeback.
          </p>
        </header>

        {/* Form */}
        <div className="mb-8 space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">WorkItem-ID</label>
              <input
                value={workItemId}
                onChange={e => setWorkItemId(e.target.value)}
                disabled={running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Titel</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Kurzbeschreibung des Tasks"
                disabled={running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ziel</label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Was soll der Agent erreichen?"
              rows={3}
              disabled={running}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Privacy Mode</label>
              <select
                value={privacyMode}
                onChange={e => setPrivacyMode(e.target.value as PrivacyMode)}
                disabled={running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:opacity-60"
              >
                <option value="local-only">Lokal only</option>
                <option value="hybrid">Hybrid</option>
                <option value="cloud-approved">Cloud approved</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Class</label>
              <select
                value={riskClass}
                onChange={e => setRiskClass(e.target.value as RiskClass)}
                disabled={running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:opacity-60"
              >
                <option value="A">A — Auto</option>
                <option value="B">B — Review</option>
                <option value="C">C — Blocked</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Budget (USD)</label>
              <input
                type="number"
                min={0.1}
                max={50}
                step={0.5}
                value={maxBudget}
                onChange={e => setMaxBudget(Number(e.target.value))}
                disabled={running}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleRun}
            disabled={running}
            className={cx(
              'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
              running
                ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                : 'bg-sky-600 text-white hover:bg-sky-500'
            )}
          >
            {running ? 'Pipeline läuft…' : 'Pilot starten'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={cx(
            'rounded-xl border p-5',
            result.status === 'completed' ? 'border-emerald-800/50 bg-emerald-900/10' : 'border-red-800/50 bg-red-900/10'
          )}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pilot Result</p>
                <p className={cx('mt-1 text-lg font-bold', result.status === 'completed' ? 'text-emerald-400' : 'text-red-400')}>
                  {result.status === 'completed' ? 'Pipeline erfolgreich' : 'Pipeline fehlgeschlagen'}
                </p>
              </div>
              <span className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-xs text-slate-400">
                {result.totalDurationMs}ms
              </span>
            </div>

            {/* Delegation bridge — shown when pilot creates a real delegation */}
            {result.delegationId && (
              <div className="mb-4 rounded-lg border border-sky-700/50 bg-sky-900/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Delegation erstellt</p>
                    <p className="mt-1 font-mono text-xs text-slate-400 break-all">{result.delegationId}</p>
                    {countdown !== null && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        Weiterleitung in {countdown}s…
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/delegations/${result.delegationId}`}
                    className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
                  >
                    Jetzt öffnen →
                  </Link>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {result.steps.map((step, i) => (
                <div key={i} className={cx(
                  'flex items-start gap-3 rounded-lg border p-3',
                  step.status === 'ok' ? 'border-emerald-800/40 bg-emerald-900/5' :
                  step.status === 'error' ? 'border-red-800/40 bg-red-900/5' :
                  step.status === 'skipped' ? 'border-amber-800/40 bg-amber-900/5' :
                  'border-slate-800 bg-slate-900/50'
                )}>
                  <span className={cx('mt-0.5 shrink-0 text-sm font-bold', stepColor(step.status))}>
                    {stepIcon(step.status)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-slate-300">{step.step}</p>
                      <span className="shrink-0 text-xs text-slate-600">{step.durationMs}ms</span>
                    </div>
                    {step.error && (
                      <p className="mt-1 text-xs text-red-300">{step.error}</p>
                    )}
                    {step.output !== undefined && (
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-500">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
