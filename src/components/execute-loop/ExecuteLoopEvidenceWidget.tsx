'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Badge, EmptyState, Metric, Panel, buttonClassName, cx } from '@/components/ui/primitives'

type EvidenceStatus = 'success' | 'partial' | 'blocked'
type EvidenceSource = 'manual' | 'runtime-aggregate' | 'harness-dry-run'

export interface ExecuteLoopEvidenceRun {
  id: string
  title: string
  status: EvidenceStatus
  source: EvidenceSource
  recordedAt: string
  prUrl?: string
  blocker?: string
  notes?: string
  steps: {
    brief: boolean
    delegation: boolean
    execute: boolean
    tests: boolean
    pr: boolean
    critic: boolean
    writeback: boolean
  }
}

interface ExecuteLoopEvidenceSummary {
  targetRuns: number
  totalRuns: number
  provenRuns: number
  dryRuns: number
  blockedRuns: number
  partialRuns: number
  progressPct: number
  currentStatus: 'not-started' | 'collecting' | 'proven' | 'blocked'
  nextAction: string
  releaseGate: {
    ready: boolean
    remainingProvenRuns: number
    reason: string
  }
}

interface EvidenceResponse {
  runs: ExecuteLoopEvidenceRun[]
  summary: ExecuteLoopEvidenceSummary
}

type LoadState = 'loading' | 'loaded' | 'error'

const STEP_LABELS: Array<[keyof ExecuteLoopEvidenceRun['steps'], string]> = [
  ['brief', 'Brief'],
  ['delegation', 'Delegation'],
  ['execute', 'Execute'],
  ['tests', 'Tests'],
  ['pr', 'PR'],
  ['critic', 'Critic'],
  ['writeback', 'Writeback'],
]

export function evidenceStatusTone(status: EvidenceStatus): 'success' | 'warning' | 'danger' {
  if (status === 'success') return 'success'
  if (status === 'partial') return 'warning'
  return 'danger'
}

export function evidenceSourceLabel(source: EvidenceSource): string {
  if (source === 'harness-dry-run') return 'Dry Run'
  if (source === 'runtime-aggregate') return 'Runtime'
  return 'Manuell'
}

export function getMissingEvidenceSteps(run: ExecuteLoopEvidenceRun): string[] {
  return STEP_LABELS.filter(([key]) => !run.steps[key]).map(([, label]) => label)
}

function statusLabel(status: ExecuteLoopEvidenceSummary['currentStatus']) {
  if (status === 'proven') return 'Produktiv belegbar'
  if (status === 'blocked') return 'Blockiert'
  if (status === 'collecting') return 'Beweise sammeln'
  return 'Noch nicht gestartet'
}

function sourceTone(source: EvidenceSource): 'neutral' | 'info' | 'success' {
  if (source === 'harness-dry-run') return 'neutral'
  if (source === 'runtime-aggregate') return 'info'
  return 'success'
}

function RunRow({ run }: { run: ExecuteLoopEvidenceRun }) {
  const missing = getMissingEvidenceSteps(run)

  return (
    <li className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={evidenceStatusTone(run.status)}>{run.status}</Badge>
            <Badge tone={sourceTone(run.source)}>{evidenceSourceLabel(run.source)}</Badge>
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-white">{run.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(run.recordedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        {run.prUrl && (
          <a href={run.prUrl} className={buttonClassName('ghost', 'shrink-0')} target="_blank" rel="noreferrer">
            PR öffnen
          </a>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {STEP_LABELS.map(([key, label]) => (
          <span
            key={key}
            className={cx(
              'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
              run.steps[key]
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-white/[0.08] bg-white/[0.04] text-slate-500',
            )}
          >
            {label}
          </span>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-3 text-xs leading-5 text-amber-300">
          Fehlt noch: {missing.join(', ')}
        </p>
      )}
      {run.blocker && <p className="mt-3 text-xs leading-5 text-rose-300">Blocker: {run.blocker}</p>}
      {run.notes && <p className="mt-3 text-xs leading-5 text-slate-400">{run.notes}</p>}
    </li>
  )
}

export function ExecuteLoopEvidenceWidget({ className }: { className?: string }) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<EvidenceResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/execute-loop/evidence', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as EvidenceResponse
        if (!cancelled) {
          setData(json)
          setLoadState('loaded')
        }
      } catch {
        if (!cancelled) setLoadState('error')
      }
    }

    void load()
    const interval = setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const recentRuns = useMemo(() => data?.runs.slice(0, 5) ?? [], [data])

  if (loadState === 'loading') {
    return (
      <Panel className={cx('animate-pulse p-6', className)}>
        <div className="h-5 w-48 rounded bg-white/[0.06]" />
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-24 rounded-xl bg-white/[0.04]" />)}
        </div>
      </Panel>
    )
  }

  if (loadState === 'error' || !data) {
    return (
      <Panel className={cx('p-6', className)}>
        <EmptyState
          title="Execute-Loop Evidence nicht verfügbar"
          description="Die App konnte den Evidence-Status gerade nicht laden. Prüfe später erneut oder öffne den Daily Report."
          action={<Link href="/api/reports/daily?format=markdown" className={buttonClassName('secondary')}>Daily Report öffnen</Link>}
        />
      </Panel>
    )
  }

  const { summary } = data
  const readyTone = summary.releaseGate.ready ? 'success' : summary.currentStatus === 'blocked' ? 'danger' : 'warning'

  return (
    <Panel className={cx('overflow-hidden', className)}>
      <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Real Value Loop</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Ist der Assistent produktiv bewiesen?</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Ziel: {summary.targetRuns} echte kleine Tickets mit Brief, Delegation, Execute, Tests, PR, Critic und Writeback.
          </p>
        </div>
        <Badge tone={readyTone}>{statusLabel(summary.currentStatus)}</Badge>
      </div>

      <div className="grid gap-px bg-white/[0.07] sm:grid-cols-4">
        <div className="bg-[#0b0d12] p-4">
          <Metric label="Bewiesen" value={`${summary.provenRuns}/${summary.targetRuns}`} detail={`${summary.progressPct}% Produktivbeweis`} tone={summary.releaseGate.ready ? 'success' : 'warning'} />
        </div>
        <div className="bg-[#0b0d12] p-4">
          <Metric label="Teilweise" value={summary.partialRuns} detail="echte Läufe mit Lücken" tone="warning" />
        </div>
        <div className="bg-[#0b0d12] p-4">
          <Metric label="Blockiert" value={summary.blockedRuns} detail="echte Läufe mit Blocker" tone={summary.blockedRuns > 0 ? 'danger' : 'neutral'} />
        </div>
        <div className="bg-[#0b0d12] p-4">
          <Metric label="Dry Runs" value={summary.dryRuns} detail="zählen nicht als Produktivbeweis" tone="neutral" />
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_1.25fr]">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Nächste sinnvolle Aktion</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{summary.nextAction}</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">{summary.releaseGate.reason}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/idea" className={buttonClassName('primary')}>Testlauf starten</Link>
            <Link href="/delegations" className={buttonClassName('secondary')}>Delegationen prüfen</Link>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Letzte Evidence Runs</h3>
            <Link href="/api/execute-loop/evidence" className="text-xs font-semibold text-violet-300 hover:text-violet-200">
              JSON ansehen
            </Link>
          </div>
          {recentRuns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] p-6 text-center text-sm text-slate-500">
              Noch keine Evidence Runs gespeichert.
            </div>
          ) : (
            <ul className="space-y-3">
              {recentRuns.map(run => <RunRow key={run.id} run={run} />)}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  )
}
