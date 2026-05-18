'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Delegation, DelegationStatus, DelegationReport } from '@/lib/models/delegation'
import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'
import { ElapsedTimer, formatCompletedDuration } from '@/components/shared/ElapsedTimer'
import { ApprovalBadge } from '@/components/shared/ApprovalBadge'
import { PolicyVerdictPanel } from '@/components/delegation/PolicyVerdictPanel'
import { PipelineRunner } from '@/components/delegation/PipelineRunner'
import { AutopilotReadinessBadge } from '@/components/delegation/AutopilotReadinessBadge'
import { LiveLogViewer } from '@/components/delegation/LiveLogViewer'
import { DelegationTimeline } from '@/components/delegation/DelegationTimeline'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-900/50 text-yellow-400 border-yellow-700',
  approved:  'bg-blue-900/50 text-blue-400 border-blue-700',
  running:   'bg-green-900/50 text-green-400 border-green-500',
  completed: 'bg-gray-800 text-gray-400 border-gray-600',
  failed:    'bg-red-900/50 text-red-400 border-red-700',
  cancelled: 'bg-gray-900 text-gray-600 border-gray-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  approved:  'Genehmigt',
  running:   'Läuft',
  completed: 'Fertig',
  failed:    'Fehler',
  cancelled: 'Abgebrochen',
}


const RISK_COLORS: Record<string, string> = {
  A: 'bg-green-900/30 text-green-400 border-green-800',
  B: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  C: 'bg-red-900/30 text-red-400 border-red-800',
}

export default function DelegationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''

  const [delegation, setDelegation] = useState<Delegation | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadDelegation = useCallback(async () => {
    try {
      const res = await fetch(`/api/delegations/${id}`)
      if (res.status === 404) { setNotFound(true); setLoading(false); return }
      const data = await res.json() as Delegation
      setDelegation(data)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadDelegation() }, [loadDelegation])

  // Auto-load existing orchestrated run for this delegation
  useEffect(() => {
    if (!id) return
    fetch(`/api/agents/orchestrate?delegationId=${id}`)
      .then(r => r.json())
      .then((d: { runs: OrchestratedRun[] }) => {
        if (d.runs && d.runs.length > 0) {
          // Load the most recent run
          setOrchestratedRun(d.runs[0])
        }
      })
      .catch(() => undefined)
  }, [id])

  const handleLiveStatusChange = useCallback((newStatus: DelegationStatus, report?: DelegationReport) => {
    setDelegation(prev => prev ? {
      ...prev,
      status: newStatus,
      ...(report ? { summaryReport: report } : {}),
      updatedAt: new Date().toISOString(),
    } : prev)
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────
  const updateStatus = async (newStatus: string) => {
    if (!delegation) return
    const updated: Delegation = { ...delegation, status: newStatus as Delegation['status'], updatedAt: new Date().toISOString() }
    setDelegation(updated)
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  const handleStart = async () => {
    if (!delegation || delegation.status !== 'approved') return
    setDelegation(prev => prev ? { ...prev, status: 'running', updatedAt: new Date().toISOString() } : prev)
    await fetch(`/api/delegations/${id}/execute`, { method: 'POST' })
    setTimeout(loadDelegation, 1500)
  }

  const [orchestratedRun, setOrchestratedRun] = useState<OrchestratedRun | null>(null)
  const [orchestrating, setOrchestrating] = useState(false)
  const [executing, setExecuting] = useState(false)

  const handleOrchestrate = async () => {
    if (!delegation) return
    setOrchestrating(true)
    try {
      const res = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegationId: delegation.id,
          delegationTitle: delegation.title || delegation.contract.goal,
          goal: delegation.contract.goal,
          context: delegation.contract.context,
        }),
      })
      const data = await res.json() as { run: OrchestratedRun }
      setOrchestratedRun(data.run)
    } finally {
      setOrchestrating(false)
    }
  }

  const handleExecuteOrchestrated = async () => {
    if (!orchestratedRun) return
    setExecuting(true)
    await fetch(`/api/agents/orchestrate/${orchestratedRun.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    // Poll for run updates every 4s
    const poll = setInterval(async () => {
      const res = await fetch(`/api/agents/orchestrate/${orchestratedRun.id}`)
      const updated = await res.json() as OrchestratedRun
      setOrchestratedRun(updated)
      if (updated.status === 'done' || updated.status === 'failed' || updated.status === 'aborted') {
        clearInterval(poll)
        setExecuting(false)
      }
    }, 4000)
  }

  const handleApprove = async () => {
    if (!delegation) return
    const now = new Date().toISOString()
    const updated: Delegation = {
      ...delegation,
      status: 'approved',
      contract: { ...delegation.contract, requiresApproval: false },
      logs: [...(delegation.logs ?? []), { timestamp: now, type: 'success', message: 'Manuell freigegeben.' }],
      updatedAt: now,
    }
    setDelegation(updated)
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-8 bg-gray-900 rounded animate-pulse w-48" />
          <div className="h-32 bg-gray-900 rounded-xl border border-gray-800 animate-pulse" />
          <div className="h-64 bg-gray-900 rounded-xl border border-gray-800 animate-pulse" />
        </div>
      </main>
    )
  }

  if (notFound || !delegation) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-400 mb-2">Delegation nicht gefunden</h1>
          <p className="text-gray-600 text-sm mb-6">ID: <code className="font-mono text-gray-500">{id}</code></p>
          <Link href="/delegations" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Zurück zur Übersicht
          </Link>
        </div>
      </main>
    )
  }

  const d = delegation
  const canApprove = d.status === 'pending' && d.contract.requiresApproval && d.contract.riskClass !== 'C'
  const canStart   = d.status === 'approved'
  const canCancel  = d.status === 'pending' || d.status === 'approved'
  const canStop    = d.status === 'running'
  const canRetry   = d.status === 'failed' || d.status === 'cancelled'
  const isDone     = d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled'

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Breadcrumb ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <Link href="/delegations" className="hover:text-gray-300 transition-colors">
            ← Delegation Center
          </Link>
          <span>/</span>
          <span className="font-mono text-gray-600 truncate max-w-xs">{d.id}</span>
          {d.briefId && (
            <>
              <span>·</span>
              <Link
                href={`/project-briefs/${d.briefId}`}
                className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                ◇ {d.briefTitle ?? 'Projektbrief'}
              </Link>
            </>
          )}
        </div>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-mono text-gray-600 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                  {d.contract.workItemId}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-md border font-semibold uppercase tracking-wider ${STATUS_COLORS[d.status] || STATUS_COLORS.pending}`}>
                  {STATUS_LABELS[d.status] || d.status}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded border font-medium ${RISK_COLORS[d.contract.riskClass] || ''}`}>
                  Risk {d.contract.riskClass}
                </span>
                <ApprovalBadge requiresApproval={d.contract.requiresApproval} riskClass={d.contract.riskClass} compact />
              </div>
              <h1 className="text-xl font-bold text-white leading-snug">{d.title || d.contract.goal}</h1>
              {d.contract.context && (
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{d.contract.context}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canApprove && (
                <button onClick={handleApprove}
                  className="px-3 py-1.5 text-sm bg-green-900/50 text-green-300 hover:bg-green-900 border border-green-800 rounded-lg transition-colors">
                  ✔ Freigeben
                </button>
              )}
              {canStart && (
                <div className="flex items-center gap-1">
                  <button onClick={handleStart}
                    className="px-3 py-1.5 text-sm bg-blue-900/50 text-blue-300 hover:bg-blue-900 border border-blue-800 rounded-lg transition-colors font-medium">
                    ▶ Starten
                  </button>
                  <button
                    onClick={async () => {
                      if (!delegation) return
                      const updated = { ...delegation, autoOrchestrate: !delegation.autoOrchestrate }
                      setDelegation(updated)
                      await fetch('/api/delegations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updated),
                      })
                    }}
                    title="Auto-Orchestrierung: Task automatisch in Sub-Tasks aufteilen"
                    className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                      delegation?.autoOrchestrate
                        ? 'bg-violet-900/60 text-violet-300 border-violet-700'
                        : 'text-slate-600 border-slate-800 hover:text-violet-400 hover:border-violet-900'
                    }`}
                  >
                    ⚙ Auto
                  </button>
                </div>
              )}
              {canStop && (
                <button onClick={() => updateStatus('cancelled')}
                  className="px-3 py-1.5 text-sm bg-red-900/50 text-red-400 hover:bg-red-900 border border-red-900 rounded-lg transition-colors">
                  ⛔ Stoppen
                </button>
              )}
              {canCancel && (
                <button onClick={() => updateStatus('cancelled')}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-yellow-400 border border-gray-800 hover:border-yellow-900/50 rounded-lg transition-colors">
                  ✕ Abbrechen
                </button>
              )}
              {canRetry && (
                <button onClick={() => updateStatus('pending')}
                  className="px-3 py-1.5 text-sm bg-blue-900/40 text-blue-400 hover:bg-blue-900 border border-blue-900/60 rounded-lg transition-colors">
                  🔄 Wiederholen
                </button>
              )}
              <button
                onClick={handleOrchestrate}
                disabled={orchestrating}
                className="px-3 py-1.5 text-xs bg-violet-900/40 text-violet-300 hover:bg-violet-900/70 border border-violet-800/60 rounded-lg transition-colors disabled:opacity-40"
                title="Task in atomare Sub-Tasks zerlegen und den besten Agenten zuweisen">
                {orchestrating ? '⚙ Zerlege…' : '⚙ Orchestrieren'}
              </button>
              <button onClick={handleCopy}
                className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${copied ? 'text-green-400 border-green-800' : 'text-gray-500 border-gray-800 hover:text-gray-300'}`}
                title="Permalink kopieren">
                {copied ? '✓ Kopiert' : '🔗 Link'}
              </button>
            </div>
          </div>

          {/* Timing */}
          <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>Erstellt: {new Date(d.createdAt).toLocaleString('de-DE')}</span>
            <span>Aktualisiert: {new Date(d.updatedAt).toLocaleString('de-DE')}</span>
            {d.status === 'running' && (
              <ElapsedTimer startedAt={d.updatedAt || d.createdAt} className="text-green-400 font-mono" />
            )}
            {isDone && d.summaryReport && (
              <span className="text-green-400/70 font-mono">
                Dauer: {formatCompletedDuration(d.createdAt, d.updatedAt)}
              </span>
            )}
          </div>
        </div>

        {/* ── Timeline ─────────────────────────────────────────────────── */}
        <DelegationTimeline delegation={d} />

        {/* ── Orchestrated Sub-Tasks ───────────────────────────────────── */}
        {orchestratedRun && (
          <div className="bg-slate-900 border border-violet-800/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">
                  Orchestrierung
                  {orchestratedRun.status === 'running' && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                  )}
                </p>
                <p className="mt-1 text-sm text-white">
                  {orchestratedRun.tasks.length} Sub-Tasks ·{' '}
                  <span className={
                    orchestratedRun.status === 'done' ? 'text-emerald-400' :
                    orchestratedRun.status === 'running' ? 'text-violet-400' :
                    orchestratedRun.status === 'failed' ? 'text-red-400' : 'text-slate-400'
                  }>
                    {orchestratedRun.status}
                  </span>
                  {orchestratedRun.overallQualityScore !== undefined && (
                    <span className="ml-2 text-xs text-emerald-400 font-bold">{orchestratedRun.overallQualityScore}pts</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(orchestratedRun.status === 'planning' || orchestratedRun.status === 'failed') && (
                  <button
                    onClick={handleExecuteOrchestrated}
                    disabled={executing}
                    className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
                  >
                    {executing ? 'Startet…' : '▶ Ausführen'}
                  </button>
                )}
                <button onClick={() => setOrchestratedRun(null)} className="text-xs text-slate-600 hover:text-slate-400">✕</button>
              </div>
            </div>
            <div className="space-y-2">
              {orchestratedRun.tasks.map((entry, i) => {
                const isRunning = entry.status === 'running'
                const isDone = entry.status === 'done'
                const isFailed = entry.status === 'failed'
                return (
                  <div key={entry.task.id} className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    isRunning ? 'border-violet-700/60 bg-violet-950/20' :
                    isDone ? 'border-emerald-900/40 bg-emerald-950/10' :
                    isFailed ? 'border-red-900/40 bg-red-950/10' :
                    'border-slate-800 bg-slate-950/60'
                  }`}>
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-xs font-bold ${
                      isDone ? 'bg-emerald-800/60 text-emerald-300' :
                      isFailed ? 'bg-red-800/60 text-red-300' :
                      isRunning ? 'bg-violet-800/60 text-violet-300' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {isDone ? '✓' : isFailed ? '✗' : isRunning ? '▶' : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">{entry.task.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">{entry.task.description}</p>
                      {entry.result && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`text-xs font-bold ${entry.result.qualityScore >= 90 ? 'text-emerald-400' : entry.result.qualityScore >= 75 ? 'text-sky-400' : 'text-amber-400'}`}>
                            {entry.result.qualityScore}pts
                          </span>
                          <span className="text-xs text-slate-600">{entry.result.grade}</span>
                          {entry.result.issues.length > 0 && (
                            <span className="text-xs text-red-400">{entry.result.issues[0]}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-xs text-violet-400 font-medium">{entry.agentType}</span>
                      <span className="block text-xs text-slate-600 mt-0.5">
                        {entry.task.effort === 'S' ? '~15min' : entry.task.effort === 'M' ? '~45min' : '~2h'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Klare Acceptance Criteria pro Task → weniger Agentic Drift
            </p>
          </div>
        )}

        {/* ── Two-column: Contract + Logs ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Contract Details */}
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contract</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Route</dt>
                  <dd className="text-gray-300 font-mono text-xs">{d.executionRoute}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Branch</dt>
                  <dd className="text-gray-300 font-mono text-xs">{d.contract.branchStrategy}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Privacy</dt>
                  <dd className="text-gray-300 text-xs">{d.contract.privacyMode}</dd>
                </div>
                {d.contract.llmModel && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Modell</dt>
                    <dd className="text-gray-300 font-mono text-xs">{d.contract.llmModel}</dd>
                  </div>
                )}
                {d.contract.outputMode && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Output</dt>
                    <dd className="text-gray-300 text-xs">{d.contract.outputMode}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Budget</dt>
                  <dd className="text-gray-300 font-mono">${d.contract.maxBudgetUsd.toFixed(2)}</dd>
                </div>
                {d.actualCostUsd != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Tatsächlich</dt>
                    <dd className="text-yellow-400 font-mono">${d.actualCostUsd.toFixed(4)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <AutopilotReadinessBadge contract={d.contract} showReasons />

            <PolicyVerdictPanel contract={d.contract} />

            <PipelineRunner
              workItemId={d.contract.workItemId ?? d.id}
              title={d.title || d.contract.goal.slice(0, 80)}
              goal={d.contract.goal}
              privacyMode={
                d.contract.privacyMode === 'local' ? 'local-only'
                : d.contract.privacyMode === 'private-cloud' ? 'hybrid'
                : 'hybrid'
              }
              riskClass={d.contract.riskClass}
              maxBudgetUsd={d.contract.maxBudgetUsd}
              delegationId={id}
            />

            {/* Definition of Done */}
            {d.contract.definitionOfDone?.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Definition of Done</h2>
                <ul className="space-y-1.5">
                  {d.contract.definitionOfDone.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 text-xs ${isDone && d.status === 'completed' ? 'text-green-400' : 'text-gray-600'}`}>
                        {isDone && d.status === 'completed' ? '✓' : '○'}
                      </span>
                      <span className={isDone && d.status === 'completed' ? 'text-gray-400 line-through decoration-green-600/40' : 'text-gray-300'}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary Report */}
            {d.summaryReport && (
              <div className="bg-gray-900 border border-green-900/40 rounded-xl p-4">
                <h2 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3">Ergebnis</h2>
                <ul className="space-y-1">
                  {d.summaryReport.keyPoints.map((pt, i) => (
                    <li key={i} className="text-sm text-green-400/80 flex items-start gap-1.5">
                      <span className="text-green-700 mt-0.5">•</span> {pt}
                    </li>
                  ))}
                </ul>
                {d.summaryReport.prUrl && (
                  <a href={d.summaryReport.prUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    → PR öffnen
                  </a>
                )}
              </div>
            )}

            {/* Note */}
            {d.note?.text && (
              <div className="bg-gray-900 border border-yellow-900/40 rounded-xl p-4">
                <h2 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-2">Notiz</h2>
                <p className="text-sm text-yellow-400/80 leading-relaxed">{d.note.text}</p>
              </div>
            )}
          </div>

          {/* Live Agent Logs */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Agent Logs
            </h2>
            <LiveLogViewer
              delegationId={id}
              initialLogs={d.logs ?? []}
              initialStatus={d.status}
              initialCostEstimate={d.contract.maxBudgetUsd}
              onStatusChange={handleLiveStatusChange}
            />
          </div>
        </div>

        {/* Allowed Tools */}
        {d.contract.allowedTools?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Erlaubte Tools</h2>
            <div className="flex flex-wrap gap-1.5">
              {d.contract.allowedTools.map(tool => (
                <span key={tool} className="px-2 py-0.5 text-xs rounded bg-gray-800 border border-gray-700 text-gray-400 font-mono">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Go back */}
        <div className="pb-4">
          <button onClick={() => router.back()} className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
            ← Zurück
          </button>
        </div>

      </div>
    </main>
  )
}
