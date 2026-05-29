'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  GitBranch,
  GitPullRequest,
  Loader2,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { Badge, EmptyState, Panel, buttonClassName, cx } from '@/components/ui/primitives'
import type {
  DemoRunStage,
  DemoRunStageStatus,
  TodoPlannerDemoRun,
} from '@/app/api/demo-runs/lib'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'ready'; demoRun: TodoPlannerDemoRun }

function stageTone(status: DemoRunStageStatus): 'success' | 'info' | 'neutral' {
  if (status === 'done') return 'success'
  if (status === 'active') return 'info'
  return 'neutral'
}

function stageIcon(status: DemoRunStageStatus) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-300" />
  if (status === 'active') return <Sparkles className="h-4 w-4 text-violet-300" />
  return <Circle className="h-4 w-4 text-slate-500" />
}

export default function TodoPlannerDemoPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/demo-runs', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const body = (await response.json()) as { ok: boolean; demoRun: TodoPlannerDemoRun | null }
        if (cancelled) return
        if (!body.ok || !body.demoRun) {
          setState({ kind: 'empty' })
          return
        }
        setState({ kind: 'ready', demoRun: body.demoRun })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
        setState({ kind: 'error', message })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#08080d] px-5 py-8 text-slate-100 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-3 py-1 text-xs font-semibold text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Demo Run
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            ToDo Planner WebApp — nachvollziehbarer erster App-Run
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Diese Seite zeigt den Demo-Run als Pipeline: Idee, Plan, Delegation, Ausfuehrung und
            den naechsten produktiven Pull Request. Alles ist typsicher unter <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-slate-200">/api/demo-runs</code> abrufbar.
          </p>
        </header>

        {state.kind === 'loading' && (
          <Panel className="p-10">
            <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
              Lade Demo-Run...
            </div>
          </Panel>
        )}

        {state.kind === 'error' && (
          <Panel className="border-rose-500/30 bg-rose-500/[0.07] p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-300" />
              <div>
                <h2 className="text-base font-semibold text-rose-100">Demo-Run nicht verfuegbar</h2>
                <p className="mt-1 text-sm leading-6 text-rose-200/80">
                  {state.message}. Pruefe <code className="rounded bg-black/30 px-1.5 py-0.5">/api/demo-runs</code> und versuche es erneut.
                </p>
              </div>
            </div>
          </Panel>
        )}

        {state.kind === 'empty' && (
          <EmptyState
            title="Noch kein Demo-Run vorhanden"
            description="Der Demo-Run wird vom API-Endpoint erzeugt. Sobald /api/demo-runs eine Antwort liefert, erscheint hier der ToDo Planner Run."
            action={
              <Link href="/api/demo-runs" className={buttonClassName('secondary')}>
                API pruefen
              </Link>
            }
          />
        )}

        {state.kind === 'ready' && <DemoRunBody demoRun={state.demoRun} />}
      </div>
    </main>
  )
}

function DemoRunBody({ demoRun }: { demoRun: TodoPlannerDemoRun }) {
  const { delegation, nextPrStep, stages } = demoRun
  return (
    <>
      <StagesPanel stages={stages} />
      <DelegationPanel delegation={delegation} />
      <NextPrStepPanel nextPrStep={nextPrStep} />
    </>
  )
}

function StagesPanel({ stages }: { stages: DemoRunStage[] }) {
  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Run-Stages</h2>
        <Badge tone="info">{stages.filter(stage => stage.status === 'done').length}/{stages.length} erledigt</Badge>
      </div>
      <ol className="grid gap-3 sm:grid-cols-5">
        {stages.map((stage, index) => (
          <li
            key={stage.id}
            className={cx(
              'rounded-lg border px-3 py-3',
              stage.status === 'done' && 'border-emerald-500/25 bg-emerald-500/[0.06]',
              stage.status === 'active' && 'border-violet-500/30 bg-violet-500/[0.08]',
              stage.status === 'pending' && 'border-white/[0.07] bg-white/[0.025]',
            )}
          >
            <div className="flex items-center gap-2">
              {stageIcon(stage.status)}
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Schritt {index + 1}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{stage.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{stage.detail}</p>
            <div className="mt-3">
              <Badge tone={stageTone(stage.status)}>
                {stage.status === 'done' ? 'Erledigt' : stage.status === 'active' ? 'Aktiv' : 'Geplant'}
              </Badge>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function DelegationPanel({ delegation }: { delegation: TodoPlannerDemoRun['delegation'] }) {
  const { contract } = delegation
  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-300" />
            <h2 className="text-lg font-semibold text-white">Delegation angelegt</h2>
            <Badge tone="info">Risk {contract.riskClass}</Badge>
            <Badge tone="success">{delegation.status}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{delegation.title}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Ziel</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{contract.goal}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Kontext</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{contract.context}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Definition of Done</p>
          <ul className="mt-2 space-y-2">
            {contract.definitionOfDone.map(item => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DetailTile label="Route" value={delegation.executionRoute} />
        <DetailTile label="Branch-Strategie" value={contract.branchStrategy} />
        <DetailTile label="Privacy" value={contract.privacyMode} />
      </div>
    </Panel>
  )
}

function NextPrStepPanel({ nextPrStep }: { nextPrStep: TodoPlannerDemoRun['nextPrStep'] }) {
  return (
    <Panel className="border-violet-500/25 bg-violet-500/[0.05] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-violet-200" />
            <h2 className="text-lg font-semibold text-white">Naechster produktiver PR-Schritt</h2>
            <Badge tone="info">Bereit zu starten</Badge>
          </div>
          <p className="mt-2 text-base font-semibold text-violet-100">{nextPrStep.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{nextPrStep.summary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone="neutral">
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              {nextPrStep.branch}
            </span>
          </Badge>
          <span className="text-xs text-slate-400">gegen <code className="rounded bg-black/30 px-1.5 py-0.5">{nextPrStep.baseBranch}</code></span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Definition of Done</p>
          <ul className="mt-2 space-y-2">
            {nextPrStep.definitionOfDone.map(item => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-200">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Geplante Dateien</p>
          <ul className="mt-2 space-y-1.5 font-mono text-xs text-slate-300">
            {nextPrStep.suggestedFiles.map(file => (
              <li key={file} className="truncate">{file}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Runbook</p>
        <ol className="mt-2 space-y-1.5 font-mono text-xs leading-6 text-slate-200">
          {nextPrStep.runbook.map((line, index) => (
            <li key={line} className="flex gap-3">
              <span className="text-slate-500">{String(index + 1).padStart(2, '0')}</span>
              <span className="truncate">{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  )
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
