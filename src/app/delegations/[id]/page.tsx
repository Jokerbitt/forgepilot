'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Delegation, DelegationStatus, DelegationReport, DoDQualityCheck } from '@/lib/models/delegation'
import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'
import { ElapsedTimer, formatCompletedDuration } from '@/components/shared/ElapsedTimer'
import { ApprovalBadge } from '@/components/shared/ApprovalBadge'
import { PolicyVerdictPanel } from '@/components/delegation/PolicyVerdictPanel'
import { PipelineRunner } from '@/components/delegation/PipelineRunner'
import { AutopilotReadinessBadge } from '@/components/delegation/AutopilotReadinessBadge'
import { LiveLogViewer } from '@/components/delegation/LiveLogViewer'
import { DelegationTimeline } from '@/components/delegation/DelegationTimeline'
import { DelegationCommentThread } from '@/components/delegation/DelegationCommentThread'
import { AgentRunReplayView } from '@/components/delegation/AgentRunReplayView'
import { GrokCriticCard } from '@/components/delegation/GrokCriticCard'
import { DelegationPipelineBreadcrumb } from '@/components/delegation/DelegationPipelineBreadcrumb'
import { KnowledgeWritebackPanel } from '@/components/delegation/KnowledgeWritebackPanel'
import { KnowledgeCardList } from '@/components/knowledge'
import { DelegationLiveLog } from '@/components/delegation/DelegationLiveLog'
import { DelegationNextActionPanel } from '@/components/delegation/DelegationNextActionPanel'
import { AgentActivityExplainer } from '@/components/delegation/AgentActivityExplainer'
import { DelegationErrorBanner } from '@/components/delegation/DelegationErrorBanner'
import { PreflightCheckList } from '@/components/delegation/PreflightCheckList'
import { CostMeter } from '@/components/delegation/CostMeter'
import { downloadLogsAsText } from '@/lib/delegations/log-export'
import { InlineNoteEditor } from '@/components/delegation/InlineNoteEditor'
import { DurationBar } from '@/components/delegation/DurationBar'
import { DelegationTagEditor } from '@/components/delegation/DelegationTagEditor'
import type { PreflightResult } from '@/lib/preflight'
import { AgentPhaseIndicator } from '@/components/delegation/AgentPhaseIndicator'
import { inferAgentPhase } from '@/lib/delegations/agent-phase'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { AffectedFilesPanel } from '@/components/delegation/AffectedFilesPanel'
import { EscalationResumePanel } from '@/components/delegation/EscalationResumePanel'

function getTaskStatusStyle(status: string): { textClass: string; icon: string; iconClass: string } {
  switch (status) {
    case 'completed':  return { textClass: 'line-through text-gray-500', icon: '✓', iconClass: 'text-green-500' }
    case 'cancelled':  return { textClass: 'line-through text-gray-500', icon: '✕', iconClass: 'text-gray-400' }
    case 'failed':     return { textClass: 'line-through text-red-400',   icon: '✕', iconClass: 'text-red-500' }
    case 'in_progress': return { textClass: '', icon: '●', iconClass: 'text-yellow-400' }
    default:           return { textClass: 'text-gray-300', icon: '○', iconClass: 'text-gray-500' }
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-gray-800 text-gray-400 border-gray-600',
  approved:  'bg-blue-900/50 text-blue-400 border-blue-700',
  running:   'bg-violet-900/50 text-violet-300 border-violet-600',
  completed: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  failed:    'bg-red-900/50 text-red-400 border-red-700',
  cancelled: 'bg-gray-950 text-gray-600 border-gray-800',
  rejected:  'bg-red-950 text-red-400 border-red-900',
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Ausstehend',
  approved:  'Genehmigt',
  running:   'Läuft',
  completed: 'Fertig',
  failed:    'Fehler',
  cancelled: 'Abgebrochen',
  rejected:  'Abgelehnt',
}

const ROUTE_LABELS: Record<string, string> = {
  'local-agent':  'Lokaler Agent',
  'runner':       'Agent Runner',
  'ollama-agent': 'Ollama (lokal)',
  'direct-chat':  'Direkt-Chat',
  'n8n':          'n8n Workflow',
  'manual':       'Manuell',
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

  // M229: shared preflight fetch — used by eager-load and manual rerun
  const runPreflight = useCallback(async (): Promise<PreflightResult | null> => {
    setPreflightLoading(true)
    setPreflightResult(null)
    try {
      const res = await fetch('/api/delegations/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegationId: id }),
      })
      if (res.ok) {
        const result = await res.json() as PreflightResult
        setPreflightResult(result)
        return result
      }
      return null
    } catch {
      return null
    } finally {
      setPreflightLoading(false)
    }
  }, [id])

  // M225: eager-load preflight checks when delegation becomes approved
  useEffect(() => {
    if (delegation?.status !== 'approved') return
    if (preflightResult || preflightLoading) return // already loaded or loading
    void runPreflight()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegation?.status, id])

  // M134: Fetch GitHub CI status when PR URL is available
  useEffect(() => {
    const prUrl = delegation?.summaryReport?.prUrl
    if (!prUrl) return
    setPrStatusLoading(true)
    fetch(`/api/github/pr-status?url=${encodeURIComponent(prUrl)}`)
      .then(r => r.json())
      .then((data: { ciState?: string; ciChecks?: Array<{ name: string; status: string; conclusion: string | null; url: string }>; state?: string; title?: string; error?: string }) => {
        if (!data.error) {
          setPrStatus({
            ciState: (data.ciState ?? 'unknown') as 'pending' | 'success' | 'failure' | 'error' | 'unknown',
            ciChecks: data.ciChecks ?? [],
            state: (data.state ?? 'open') as 'open' | 'closed' | 'merged',
            title: data.title ?? '',
          })
        }
      })
      .catch(() => undefined)
      .finally(() => setPrStatusLoading(false))
  }, [delegation?.summaryReport?.prUrl])

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

    // Run preflight checks; block on blockers, allow warnings through
    const preflightRes = await runPreflight()
    if (preflightRes && !preflightRes.canStart) return // blockers present — do not execute

    setDelegation(prev => prev ? { ...prev, status: 'running', updatedAt: new Date().toISOString() } : prev)
    await fetch(`/api/delegations/${id}/execute`, { method: 'POST' })
    setTimeout(loadDelegation, 1500)
  }

  // Retry with escalation: reset to pending, bump LLM model preference to best available
  const handleRetryEscalate = async () => {
    if (!delegation) return
    const updated: Delegation = {
      ...delegation,
      status: 'pending',
      contract: {
        ...delegation.contract,
        llmModel: 'auto-best', // signals auto-router to pick cloud/best model
      },
      updatedAt: new Date().toISOString(),
    }
    setDelegation(updated)
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  const [orchestratedRun, setOrchestratedRun] = useState<OrchestratedRun | null>(null)
  const [orchestrating, setOrchestrating] = useState(false)
  const [executing, setExecuting] = useState(false)
  const orchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Knowledge writeback card count for this delegation
  const [writebackCount, setWritebackCount] = useState<number | null>(null)
  useEffect(() => {
    if (!id) return
    fetch(`/api/knowledge-cards?sourceId=${id}`)
      .then(r => r.json())
      .then((d: { total?: number }) => setWritebackCount(d.total ?? 0))
      .catch(() => undefined)
  }, [id])

  const [creatingPR, setCreatingPR] = useState(false)
  const [prError, setPrError] = useState<string | null>(null)
  const [logsExpanded, setLogsExpanded] = useState(false)

  // M134: GitHub CI status
  const [prStatus, setPrStatus] = useState<{
    ciState: 'pending' | 'success' | 'failure' | 'error' | 'unknown'
    ciChecks: Array<{ name: string; status: string; conclusion: string | null; url: string }>
    state: 'open' | 'closed' | 'merged'
    title: string
  } | null>(null)
  const [prStatusLoading, setPrStatusLoading] = useState(false)

  // M224: preflight checks shown before execute
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null)
  const [preflightLoading, setPreflightLoading] = useState(false)

  // M230: clone delegation
  const [cloningDelegation, setCloningDelegation] = useState(false)

  // Local merge
  const [merging, setMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<{ merged: boolean; mergeCommit?: string; baseBranch?: string; githubRemote?: boolean } | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)

  // App Preview
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // DoD Quality Check
  const [qualityCheck, setQualityCheck] = useState<DoDQualityCheck | null>(
    (delegation as (Delegation & { qualityCheck?: DoDQualityCheck }) | null)?.qualityCheck ?? null
  )
  const [qualityCheckLoading, setQualityCheckLoading] = useState(false)

  const handleOpenPreview = async () => {
    if (!delegation) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/delegations/${id}/preview`, { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string; message?: string }
      if (data.url) {
        setPreviewUrl(data.url)
        window.open(data.url, '_blank', 'noopener')
      } else if (data.message) {
        alert(data.message)
      } else if (data.error) {
        alert(`Vorschau-Fehler: ${data.error}`)
      }
    } catch {
      alert('Vorschau konnte nicht gestartet werden.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleQualityCheck = async () => {
    if (!delegation) return
    setQualityCheckLoading(true)
    try {
      const res = await fetch(`/api/delegations/${id}/quality-check`, { method: 'POST' })
      const data = await res.json() as { qualityCheck?: DoDQualityCheck; error?: string }
      if (res.ok && data.qualityCheck) {
        setQualityCheck(data.qualityCheck)
      } else {
        alert(`Qualitäts-Check fehlgeschlagen: ${data.error ?? 'Unbekannter Fehler'}`)
      }
    } catch {
      alert('Qualitäts-Check konnte nicht gestartet werden.')
    } finally {
      setQualityCheckLoading(false)
    }
  }

  const handleMerge = async () => {
    if (!delegation) return
    setMerging(true)
    setMergeError(null)
    try {
      const res = await fetch(`/api/delegations/${id}/merge`, { method: 'POST' })
      const data = await res.json() as { merged?: boolean; mergeCommit?: string; baseBranch?: string; githubRemote?: boolean; error?: string }
      if (res.ok && data.merged) {
        setMergeResult(data as { merged: boolean; mergeCommit?: string; baseBranch?: string; githubRemote?: boolean })
      } else {
        setMergeError(data.error ?? 'Merge fehlgeschlagen')
      }
    } catch {
      setMergeError('Netzwerkfehler beim Mergen')
    } finally {
      setMerging(false)
    }
  }

  const handleClone = async () => {
    if (!delegation) return
    setCloningDelegation(true)
    try {
      const res = await fetch(`/api/delegations/${id}/clone`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { delegationId: string }
        router.push(`/delegations/${data.delegationId}`)
      }
    } catch {
      // ignore
    } finally {
      setCloningDelegation(false)
    }
  }

  const handleCreatePR = async () => {
    if (!delegation) return
    setCreatingPR(true)
    setPrError(null)
    try {
      const res = await fetch(`/api/delegations/${id}/create-pr`, { method: 'POST' })
      const data = await res.json() as { prUrl?: string; prNumber?: number; status?: string; error?: string }
      if (data.prUrl) {
        setDelegation(prev => prev
          ? {
              ...prev,
              summaryReport: prev.summaryReport
                ? { ...prev.summaryReport, prUrl: data.prUrl }
                : { keyPoints: [], changes: [], timeTakenMinutes: 0, prUrl: data.prUrl },
            }
          : prev)
      }
      if (data.status === 'error') {
        setPrError(data.error ?? 'PR-Erstellung fehlgeschlagen')
      }
    } catch {
      setPrError('Netzwerkfehler beim Erstellen des PRs')
    } finally {
      setCreatingPR(false)
    }
  }

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

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (orchPollRef.current) clearInterval(orchPollRef.current)
    }
  }, [])

  const handleExecuteOrchestrated = async () => {
    if (!orchestratedRun) return
    setExecuting(true)
    const runId = orchestratedRun.id
    await fetch(`/api/agents/orchestrate/${runId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    // Poll for run updates every 4s — store ref for cleanup
    if (orchPollRef.current) clearInterval(orchPollRef.current)
    orchPollRef.current = setInterval(async () => {
      const res = await fetch(`/api/agents/orchestrate/${runId}`)
      const updated = await res.json() as OrchestratedRun
      setOrchestratedRun(updated)
      if (updated.status === 'done' || updated.status === 'failed' || updated.status === 'aborted') {
        if (orchPollRef.current) clearInterval(orchPollRef.current)
        orchPollRef.current = null
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

  const handleReject = async () => {
    if (!delegation) return
    const res = await fetch(`/api/delegations/${delegation.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'user' }),
    })
    if (res.ok) {
      const updated = await res.json() as Delegation
      setDelegation(updated)
    }
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
  const canApprove  = d.status === 'pending' && d.contract.requiresApproval && d.contract.riskClass !== 'C'
  const canReject   = d.status === 'pending'
  const canStart    = d.status === 'approved'
  const canCancel   = d.status === 'pending' || d.status === 'approved'
  const canStop     = d.status === 'running'
  const canRetry    = d.status === 'failed' || d.status === 'cancelled'
  const isDone      = d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled'
  const canCreatePR = d.status === 'completed' && !d.summaryReport?.prUrl
  const canClone    = isDone

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Breadcrumb ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                  ← Zum Brief: {d.briefTitle ?? 'Projektbrief'}
                </Link>
              </>
            )}
          </div>
          {/* Pipeline progress */}
          <DelegationPipelineBreadcrumb
            status={d.status}
            hasPr={!!d.summaryReport?.prUrl}
          />
        </div>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Link
                  href={`/work-items?q=${encodeURIComponent(d.contract.workItemId ?? '')}`}
                  className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded border border-gray-700 hover:border-gray-600 hover:text-gray-300 transition-colors"
                >
                  {d.contract.workItemId}
                </Link>
                <span className={`px-2 py-0.5 text-xs rounded-md border font-semibold uppercase tracking-wider ${STATUS_COLORS[d.status] || STATUS_COLORS.pending} ${d.status === 'running' ? 'animate-pulse' : ''}`}>
                  {STATUS_LABELS[d.status] || d.status}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded border font-medium ${RISK_COLORS[d.contract.riskClass] || ''}`}>
                  Risk {d.contract.riskClass}
                </span>
                <ApprovalBadge requiresApproval={d.contract.requiresApproval} riskClass={d.contract.riskClass} compact />
                {d.contract.outputPolicy && d.contract.outputPolicy !== 'none' && (
                  <span className="px-2 py-0.5 text-xs rounded border border-indigo-800/50 bg-indigo-950/30 text-indigo-400 font-medium">
                    {d.contract.outputPolicy === 'pr' ? '⎇ PR'
                     : d.contract.outputPolicy === 'writeback' ? '📝 Writeback'
                     : d.contract.outputPolicy === 'pr-and-writeback' ? '⎇ PR + 📝' : null}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-white leading-snug">{d.title || d.contract.goal}</h1>
              {/* Live phase indicator — shows current execution state at a glance */}
              <div className="mt-2 flex flex-wrap items-start gap-3">
                <AgentPhaseIndicator info={inferAgentPhase(d)} showProgress />
                <AffectedFilesPanel
                  logs={d.logs}
                  summaryReport={d.summaryReport}
                  isRunning={d.status === 'running'}
                />
              </div>
              {d.contract.context && (
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{d.contract.context}</p>
              )}
              {d.contract.writeScope && d.contract.writeScope.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.contract.writeScope.slice(0, 8).map(s => (
                    <span key={s} className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-500 font-mono">
                      {s}
                    </span>
                  ))}
                  {d.contract.writeScope.length > 8 && (
                    <span className="text-[10px] text-gray-600">+{d.contract.writeScope.length - 8}</span>
                  )}
                </div>
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
              {canReject && (
                <button onClick={handleReject}
                  className="px-3 py-1.5 text-sm bg-red-950/50 text-red-400 hover:bg-red-950 border border-red-900/60 rounded-lg transition-colors">
                  ✕ Ablehnen
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
              {canCreatePR && (
                <button
                  onClick={handleCreatePR}
                  disabled={creatingPR}
                  className="px-3 py-1.5 text-xs bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/70 border border-emerald-800/60 rounded-lg transition-colors disabled:opacity-40"
                  title="GitHub Pull Request für diese abgeschlossene Delegation erstellen">
                  {creatingPR ? '⏳ PR wird erstellt…' : '⎇ GitHub PR erstellen'}
                </button>
              )}
              {canClone && (
                <button
                  onClick={handleClone}
                  disabled={cloningDelegation}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 rounded-lg transition-colors disabled:opacity-40"
                  title="Delegation als neuen Entwurf duplizieren">
                  {cloningDelegation ? '⏳ …' : '⧉ Klonen'}
                </button>
              )}
              {d.summaryReport?.prUrl && (
                <div className="flex items-center gap-1.5">
                  <a
                    href={d.summaryReport.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-emerald-950/40 text-emerald-400 hover:text-emerald-300 border border-emerald-900/60 rounded-lg transition-colors"
                    title="Pull Request auf GitHub öffnen">
                    ⎇ PR #{d.summaryReport.prUrl.match(/\/pull\/(\d+)/)?.[1] ?? ''}
                  </a>
                  {d.summaryReport.prState === 'merged' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-950/50 text-violet-300 border border-violet-800/40" title={d.summaryReport.prMergedAt ? `Gemergt: ${new Date(d.summaryReport.prMergedAt).toLocaleString('de-DE')}` : 'Gemergt'}>
                      Merged
                    </span>
                  )}
                  {d.summaryReport.prState === 'closed' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-950/50 text-red-400 border border-red-800/40">
                      Closed
                    </span>
                  )}
                  {(d.summaryReport.prState === 'open' || !d.summaryReport.prState) && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                      Open
                    </span>
                  )}
                </div>
              )}
              {prError && (
                <span className="text-xs text-red-400 border border-red-900/40 bg-red-950/20 rounded-lg px-2 py-1.5 max-w-xs truncate" title={prError}>
                  ⚠ {prError}
                </span>
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
              {(d.logs ?? []).length > 0 && (
                <button
                  onClick={() => downloadLogsAsText(d)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
                  title="Logs als Textdatei herunterladen">
                  ⬇ Logs
                </button>
              )}
            </div>
          </div>

          {/* ── Metrics Tiles (above-the-fold trust layer) ──────────── */}
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" style={(d.retryCount ?? 0) > 0 ? { gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' } : undefined}>

            {/* Status tile */}
            <div className="bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Status</span>
              <span className={`text-xs font-bold ${STATUS_COLORS[d.status]?.split(' ')[1] ?? 'text-gray-400'}`}>
                {STATUS_LABELS[d.status] || d.status}
              </span>
              {d.status === 'running' && (
                <ElapsedTimer startedAt={d.startedAt ?? d.updatedAt ?? d.createdAt} className="text-[10px] text-green-400 font-mono" />
              )}
              {isDone && d.startedAt && d.completedAt && (
                <span className="text-[10px] text-gray-600 font-mono">{formatCompletedDuration(d.startedAt, d.completedAt)}</span>
              )}
              {isDone && (!d.startedAt || !d.completedAt) && d.summaryReport && (
                <span className="text-[10px] text-gray-600 font-mono">{formatCompletedDuration(d.createdAt, d.updatedAt)}</span>
              )}
            </div>

            {/* Risk tile */}
            <div className="bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Risiko</span>
              <span className={`text-xs font-bold ${RISK_COLORS[d.contract.riskClass]?.split(' ')[1] ?? 'text-gray-400'}`}>
                Risk {d.contract.riskClass}
              </span>
              <span className="text-[10px] text-gray-600">{ROUTE_LABELS[d.executionRoute] ?? d.executionRoute}</span>
            </div>

            {/* Cost tile */}
            <div className="bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Kosten</span>
              <CostMeter
                actualCostUsd={d.actualCostUsd}
                estimateCostUsd={d.costEstimateUsd}
                maxBudgetUsd={d.contract.maxBudgetUsd}
              />
            </div>

            {/* PR tile */}
            <div className="bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">PR</span>
              {d.summaryReport?.prUrl ? (
                <a
                  href={d.summaryReport.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                >
                  ⎇ #{d.summaryReport.prUrl.match(/\/pull\/(\d+)/)?.[1] ?? ''}
                </a>
              ) : (
                <span className="text-xs text-gray-600">Kein PR</span>
              )}
              {prStatus && (
                <span className={`text-[10px] font-medium ${
                  prStatus.state === 'merged' ? 'text-violet-400' :
                  prStatus.state === 'closed' ? 'text-gray-500' :
                  'text-emerald-500'
                }`}>
                  {prStatus.state === 'merged' ? 'Merged' : prStatus.state === 'closed' ? 'Closed' : 'Open'}
                  {prStatus.ciState === 'success' ? ' · CI ✓' : prStatus.ciState === 'failure' ? ' · CI ✗' : ''}
                </span>
              )}
            </div>

            {/* Grok Critic tile */}
            <div className="bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Critic</span>
              {d.criticScore ? (
                <>
                  <span className={`text-xs font-bold ${
                    d.criticScore.verdict === 'approved' ? 'text-emerald-400' :
                    d.criticScore.verdict === 'needs-revision' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {d.criticScore.verdict === 'approved' ? '✓ OK' :
                     d.criticScore.verdict === 'needs-revision' ? '⚠ Revision' : '✗ Abgelehnt'}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {Math.round((d.criticScore.correctness + d.criticScore.efficiency + d.criticScore.drift) / 3)}pts
                  </span>
                </>
              ) : d.status === 'completed' ? (
                <span className="text-xs text-gray-600 italic">Ausstehend</span>
              ) : (
                <span className="text-xs text-gray-700">–</span>
              )}
            </div>
            {/* Writeback tile */}
            <div className="bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Writeback</span>
              {writebackCount === null ? (
                <span className="text-xs text-gray-700">–</span>
              ) : writebackCount > 0 ? (
                <a href="/knowledge-cards" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                  {writebackCount} Karten
                </a>
              ) : (
                <span className="text-xs text-gray-600">Keine</span>
              )}
            </div>

            {/* Retry tile — only shown when retryCount > 0 */}
            {(d.retryCount ?? 0) > 0 && (
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Retries</span>
                <span className="text-sm font-bold text-amber-400">↺ {d.retryCount}</span>
                <span className="text-[10px] text-amber-700/70">Versuche</span>
              </div>
            )}
          </div>

          {/* ── Simulation-mode info ─────────────────────────────────── */}
          {(d.executionRoute === 'direct-chat' || d.executionRoute === 'n8n') && d.status === 'pending' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-900/40 bg-blue-950/20 px-3 py-2.5 text-xs text-blue-300/80">
              <span className="shrink-0 mt-0.5">ℹ</span>
              <span>
                Diese Delegation läuft im <strong>Simulations-Modus</strong> (Route: {d.executionRoute}).
                Für echte Ausführung Claude CLI oder einen lokalen Agenten konfigurieren.
              </span>
            </div>
          )}

          {/* ── Duration Timeline Bar ─────────────────────────────────── */}
          <DurationBar
            createdAt={d.createdAt}
            startedAt={d.startedAt}
            completedAt={d.completedAt}
            status={d.status}
          />

          {/* ── Timing ───────────────────────────────────────────────── */}
          <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-gray-700">
            <span>Erstellt: {new Date(d.createdAt).toLocaleString('de-DE')}</span>
            <span>Aktualisiert: {new Date(d.updatedAt).toLocaleString('de-DE')}</span>
          </div>

          {/* ── M230: Chain links ────────────────────────────────────── */}
          {(d.chainedDelegationId || d.chainedFromId) && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {d.chainedFromId && (
                <Link
                  href={`/delegations/${d.chainedFromId}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-700 bg-gray-900 text-gray-400 hover:text-violet-300 hover:border-violet-800 transition-colors"
                >
                  <span className="text-gray-600">←</span>
                  Fortgesetzt von: <span className="font-mono text-gray-500 truncate max-w-[160px]">{d.chainedFromId.slice(0, 8)}…</span>
                </Link>
              )}
              {d.chainedDelegationId && (
                <Link
                  href={`/delegations/${d.chainedDelegationId}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-violet-900/60 bg-violet-950/30 text-violet-300 hover:text-violet-200 hover:border-violet-700 transition-colors"
                >
                  <span>→</span>
                  Weiter mit: <span className="font-mono text-violet-400 truncate max-w-[160px]">{d.chainedDelegationId.slice(0, 8)}…</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Structured error recovery (when failed) ─────────────────── */}
        {d.status === 'failed' && d.errorMessage && (
          <DelegationErrorBanner errorMessage={d.errorMessage} />
        )}

        {/* ── Escalation Resume Panel ──────────────────────────────────── */}
        {d.status === 'pending' && (d.logs ?? []).some(l => l.message.includes('ESKALATION:') || l.message.includes('ESCALATION:')) && (
          <EscalationResumePanel
            delegationId={d.id}
            logs={d.logs ?? []}
            onResumed={() => {
              setDelegation(prev => prev ? { ...prev, status: 'approved', updatedAt: new Date().toISOString() } : prev)
              setTimeout(loadDelegation, 500)
            }}
          />
        )}

        {/* ── Next Action Panel ────────────────────────────────────────── */}
        <DelegationNextActionPanel
          delegation={d}
          onApprove={handleApprove}
          onStart={handleStart}
          onRetry={() => updateStatus('pending')}
          onRetryEscalate={handleRetryEscalate}
          onCreatePR={handleCreatePR}
          creatingPR={creatingPR}
          lastLogMessage={d.status === 'running' ? (d.logs ?? []).filter(l => l.type !== 'thought').slice(-1)[0]?.message : undefined}
        />

        {/* ── Agent activity explainer ─────────────────────────────────── */}
        <AgentActivityExplainer delegation={d} />

        {/* ── Preflight Results (M224) ─────────────────────────────────── */}
        {(preflightLoading || preflightResult) && (
          <PreflightCheckList
            result={preflightResult}
            loading={preflightLoading}
            onRerun={d.status === 'approved' ? () => void runPreflight() : undefined}
          />
        )}

        {/* ── Live Execution Progress ──────────────────────────────────── */}
        <DelegationLiveLog
          delegationId={d.id}
          isRunning={d.status === 'running'}
          onCostUpdate={(cost) => setDelegation(prev => prev ? { ...prev, actualCostUsd: cost } : prev)}
        />

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
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      <span className="block text-xs text-violet-400 font-medium">{entry.agentType}</span>
                      <span className="block text-xs text-slate-600">
                        {entry.task.effort === 'S' ? '~15min' : entry.task.effort === 'M' ? '~45min' : '~2h'}
                      </span>
                      {entry.retryCount > 0 && (
                        <span className="text-xs text-amber-500">↺ {entry.retryCount}x</span>
                      )}
                      {isFailed && orchestratedRun.maxRetries > entry.retryCount && (
                        <button
                          onClick={async () => {
                            await fetch(`/api/agents/orchestrate/${orchestratedRun.id}/tasks/${entry.task.id}/retry`, { method: 'POST' })
                            const res = await fetch(`/api/agents/orchestrate/${orchestratedRun.id}`)
                            setOrchestratedRun(await res.json() as OrchestratedRun)
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 border border-amber-800/40 rounded px-1.5 py-0.5 hover:bg-amber-950/30 transition-colors"
                        >
                          ↺ Retry
                        </button>
                      )}
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

        {/* ── Context Snapshot (M305) ──────────────────────────────────── */}
        {d.contextSnapshot && d.contextSnapshot.cards.length > 0 && (
          <details className="bg-gray-900 border border-gray-800 rounded-xl p-5 group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Kontext bei Ausführung ({d.contextSnapshot.cards.length} Karten · ~{d.contextSnapshot.tokenEstimate} Tokens)
              </h2>
              <span className="text-gray-600 text-xs group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <ul className="mt-3 space-y-1">
              {d.contextSnapshot.cards.map(card => (
                <li key={card.id} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="mt-0.5 px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-mono shrink-0">{card.type}</span>
                  <span>{card.title}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-gray-600">
              Erstellt: {new Date(d.contextSnapshot.builtAt).toLocaleString('de-DE')}
            </p>
          </details>
        )}

        {/* ── Knowledge Writeback ───────────────────────────────────────── */}
        {(d.status === 'completed' || d.status === 'failed') && (
          <KnowledgeWritebackPanel delegationId={id} delegation={d} />
        )}

        {/* ── Gelerntes Wissen (full KnowledgeCardList with delegation link) ── */}
        {d.status === 'completed' && (
          <section className="bg-gray-900 border border-emerald-900/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Gelerntes Wissen
              </h2>
              <a
                href="/knowledge-cards"
                className="text-xs text-emerald-600 hover:text-emerald-400 transition-colors"
              >
                Alle Wissenskarten →
              </a>
            </div>
            <KnowledgeCardList delegationId={id} />
          </section>
        )}

        {/* ── PR Details (wenn PR vorhanden) ────────────────────────────── */}
        {d.summaryReport?.prUrl && (
          <div className="bg-gray-900 border border-emerald-900/30 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3">Pull Request</h2>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-0">
                <a href={d.summaryReport.prUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                  ⎇ PR #{d.summaryReport.prUrl.match(/\/pull\/(\d+)/)?.[1] ?? ''} auf GitHub öffnen
                </a>
                {prStatusLoading && (
                  <span className="ml-3 text-[10px] text-gray-600">CI-Status wird geladen…</span>
                )}
              </div>
              {prStatus && !prStatusLoading && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${
                    prStatus.state === 'merged' ? 'bg-violet-950/40 text-violet-400 border-violet-800' :
                    prStatus.state === 'closed' ? 'bg-gray-900 text-gray-500 border-gray-700' :
                    'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                  }`}>
                    {prStatus.state === 'merged' ? '⎇ Merged' : prStatus.state === 'closed' ? '⊘ Closed' : '⎇ Open'}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${
                    prStatus.ciState === 'success' ? 'bg-green-950/40 text-green-400 border-green-800' :
                    prStatus.ciState === 'failure' ? 'bg-red-950/40 text-red-400 border-red-800' :
                    prStatus.ciState === 'pending' ? 'bg-yellow-950/40 text-yellow-400 border-yellow-800' :
                    'bg-gray-900 text-gray-500 border-gray-700'
                  }`}>
                    {prStatus.ciState === 'success' ? '✓ CI grün' :
                     prStatus.ciState === 'failure' ? '✗ CI fehlgeschlagen' :
                     prStatus.ciState === 'pending' ? '⏳ CI läuft' : '○ CI unbekannt'}
                  </span>
                </div>
              )}
            </div>
            {prStatus?.ciChecks && prStatus.ciChecks.length > 0 && (
              <div className="mt-3 flex flex-col gap-0.5">
                {prStatus.ciChecks.slice(0, 6).map((check, i) => (
                  <a key={i} href={check.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                    <span className={
                      check.conclusion === 'success' ? 'text-green-500' :
                      check.conclusion === 'failure' ? 'text-red-500' :
                      check.status === 'in_progress' ? 'text-yellow-500' : 'text-gray-600'
                    }>
                      {check.conclusion === 'success' ? '✓' : check.conclusion === 'failure' ? '✗' : check.status === 'in_progress' ? '⏳' : '○'}
                    </span>
                    <span className="truncate max-w-[300px]">{check.name}</span>
                  </a>
                ))}
                {prStatus.ciChecks.length > 6 && (
                  <span className="text-[10px] text-gray-600">+{prStatus.ciChecks.length - 6} weitere…</span>
                )}
              </div>
            )}
            {d.summaryReport?.keyPoints && d.summaryReport.keyPoints.length > 0 && (
              <ul className="mt-3 pt-3 border-t border-gray-800 space-y-1">
                {d.summaryReport.keyPoints.map((pt, i) => (
                  <li key={i} className="text-sm text-green-400/80 flex items-start gap-1.5">
                    <span className="text-green-700 mt-0.5 shrink-0">•</span> {pt}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Grok Critic Review (full card, wenn completed) ─────────────── */}
        {d.status === 'completed' && (
          <GrokCriticCard
            delegationId={id}
            agentOutput={
              d.summaryReport
                ? [
                    ...(d.summaryReport.keyPoints ?? []),
                    ...(d.summaryReport.changes ?? []),
                  ].join('\n')
                : d.contract.goal
            }
            grokConfigured={typeof process !== 'undefined'
              ? true  // assume configured client-side; API returns 503 if not
              : false
            }
            initialScore={d.criticScore}
          />
        )}

        {/* ── Two-column: Contract + Details ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Contract Details */}
          <div className="space-y-4">
            <CollapsibleSection
              title="Technische Details"
              collapsedHint={`${d.executionRoute} · Risk ${d.contract.riskClass}${d.contract.maxBudgetUsd != null ? ` · $${d.contract.maxBudgetUsd.toFixed(2)}` : ''}`}
              defaultOpen={false}
            >
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
                  <dd className="text-gray-300 font-mono">{d.contract.maxBudgetUsd != null ? `$${d.contract.maxBudgetUsd.toFixed(2)}` : '–'}</dd>
                </div>
                {d.actualCostUsd != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Tatsächlich</dt>
                    <dd className="text-yellow-400 font-mono">${d.actualCostUsd.toFixed(4)}</dd>
                  </div>
                )}
              </dl>
            </CollapsibleSection>

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
                  {d.contract.definitionOfDone.map((item, i) => {
                    const style = getTaskStatusStyle(d.status)
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 text-xs ${style.iconClass}`}>
                          {style.icon}
                        </span>
                        <span className={style.textClass || 'text-gray-300'}>{item}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Summary Report keyPoints — only if no prUrl (prUrl case handled above) */}
            {d.summaryReport && !d.summaryReport.prUrl && d.summaryReport.keyPoints && (
              <div className="bg-gray-900 border border-green-900/40 rounded-xl p-4">
                <h2 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3">Ergebnis</h2>
                <ul className="space-y-1">
                  {d.summaryReport.keyPoints.map((pt, i) => (
                    <li key={i} className="text-sm text-green-400/80 flex items-start gap-1.5">
                      <span className="text-green-700 mt-0.5">•</span> {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tags */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Tags</h2>
              <DelegationTagEditor
                delegationId={d.id}
                initialTags={d.tags ?? []}
                onSaved={(tags) => setDelegation(prev => prev ? { ...prev, tags } : prev)}
              />
            </div>

            {/* Note — inline editable */}
            <div className="bg-gray-900 border border-yellow-900/40 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-2">Notiz</h2>
              <InlineNoteEditor
                delegationId={d.id}
                initialText={d.note?.text}
                onSaved={(text) =>
                  setDelegation(prev => prev ? {
                    ...prev,
                    note: text ? { text, updatedAt: new Date().toISOString() } : undefined,
                  } : prev)
                }
              />
            </div>
          </div>

          {/* Right column: Logs (collapsed by default) */}
          <div className="space-y-4">
            {/* ── Execution Log (collapsed by default) ─────────────── */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setLogsExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
              >
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${d.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                  Ausführungsprotokoll
                  {d.logs && d.logs.length > 0 && (
                    <span className="ml-1 text-[10px] text-gray-700 font-mono normal-case">{d.logs.length} Einträge</span>
                  )}
                </h2>
                <span className="text-xs text-gray-600">{logsExpanded ? '▲ Einklappen' : '▼ Protokoll anzeigen'}</span>
              </button>
              {logsExpanded && (
                <div className="px-4 pb-4">
                  <LiveLogViewer
                    delegationId={id}
                    initialLogs={d.logs ?? []}
                    initialStatus={d.status}
                    initialCostEstimate={d.contract.maxBudgetUsd}
                    onStatusChange={handleLiveStatusChange}
                  />
                </div>
              )}
              {!logsExpanded && d.status === 'running' && (
                <div className="px-4 pb-3">
                  {/* Always render LiveLogViewer when running so status changes are received */}
                  <div className="hidden">
                    <LiveLogViewer
                      delegationId={id}
                      initialLogs={d.logs ?? []}
                      initialStatus={d.status}
                      initialCostEstimate={d.contract.maxBudgetUsd}
                      onStatusChange={handleLiveStatusChange}
                    />
                  </div>
                  <p className="text-xs text-green-400/60 italic">Agent läuft — Protokoll anzeigen um Details zu sehen.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* App Preview — shown when completed and targetRepo is set */}
        {d.status === 'completed' && (d as { targetRepo?: string }).targetRepo && (
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/10 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-300">Ergebnis ansehen</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Agent hat Änderungen auf einen Feature-Branch committed. Starte einen Preview-Server um die App zu testen.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline font-mono"
                >
                  {previewUrl}
                </a>
              )}
              <button
                onClick={handleOpenPreview}
                disabled={previewLoading}
                className="rounded-lg border border-emerald-700/60 bg-emerald-900/30 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-800/40 hover:text-emerald-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {previewLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                    Starte…
                  </>
                ) : previewUrl ? (
                  '↗ Erneut öffnen'
                ) : (
                  '▶ Im Browser öffnen'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Merge + PR Panel — shown when completed */}
        {d.status === 'completed' && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/20 p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Ergebnis übernehmen</p>
            <div className="flex flex-wrap items-center gap-2">

              {/* Merge in main */}
              {!mergeResult ? (
                <button
                  onClick={handleMerge}
                  disabled={merging}
                  className="flex items-center gap-2 rounded-lg border border-violet-700/60 bg-violet-950/30 px-4 py-2 text-sm font-semibold text-violet-300 hover:border-violet-500 hover:text-violet-200 transition-colors disabled:opacity-50"
                >
                  {merging ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border border-violet-400 border-t-transparent" />
                      Mergt…
                    </>
                  ) : (
                    <>⎇ In main mergen</>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-3 py-2">
                  <span className="text-emerald-400 text-sm">✓ Gemergt</span>
                  {mergeResult.mergeCommit && (
                    <span className="font-mono text-xs text-slate-500">{mergeResult.mergeCommit}</span>
                  )}
                  {mergeResult.baseBranch && (
                    <span className="text-xs text-slate-600">→ {mergeResult.baseBranch}</span>
                  )}
                </div>
              )}

              {/* GitHub PR — always available for completed delegations */}
              {!d.summaryReport?.prUrl ? (
                <button
                  onClick={handleCreatePR}
                  disabled={creatingPR}
                  className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-slate-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  {creatingPR ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-400 border-t-transparent" />
                      Erstellt PR…
                    </>
                  ) : (
                    <>⤴ GitHub PR erstellen</>
                  )}
                </button>
              ) : (
                <a
                  href={d.summaryReport.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-3 py-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  ⤴ PR #{d.summaryReport.prUrl.match(/\/pull\/(\d+)/)?.[1] ?? ''}
                  {d.summaryReport.prState === 'merged' && (
                    <span className="text-xs text-violet-400">· Merged</span>
                  )}
                </a>
              )}

              {/* Errors */}
              {mergeError && (
                <p className="w-full text-xs text-red-400 mt-1">{mergeError}</p>
              )}
              {prError && (
                <p className="w-full text-xs text-red-400 mt-1">{prError}</p>
              )}

              {/* Hint after merge: GitHub PR available */}
              {mergeResult?.githubRemote && !d.summaryReport?.prUrl && (
                <p className="w-full text-xs text-slate-500 mt-0.5">
                  Repo hat GitHub Remote — du kannst jetzt auch einen PR erstellen.
                </p>
              )}
            </div>
          </div>
        )}

        {/* DoD Quality Check — shown when completed and DoD defined */}
        {d.status === 'completed' && d.contract.definitionOfDone?.length > 0 && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200">DoD Qualitäts-Check</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  KI bewertet ob der Agent alle Kriterien erfüllt hat
                </p>
              </div>
              {!qualityCheck && (
                <button
                  onClick={handleQualityCheck}
                  disabled={qualityCheckLoading}
                  className="rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {qualityCheckLoading ? (
                    <>
                      <span className="h-2.5 w-2.5 animate-spin rounded-full border border-slate-400 border-t-transparent" />
                      Prüft…
                    </>
                  ) : '✦ Jetzt prüfen'}
                </button>
              )}
              {qualityCheck && (
                <button
                  onClick={handleQualityCheck}
                  disabled={qualityCheckLoading}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-50"
                >
                  {qualityCheckLoading ? 'Prüft…' : '↺ Neu prüfen'}
                </button>
              )}
            </div>

            {qualityCheck && (
              <>
                {/* Verdict banner */}
                <div className={`rounded-lg px-3 py-2 flex items-center justify-between ${
                  qualityCheck.verdict === 'passed'
                    ? 'bg-emerald-950/40 border border-emerald-800/50'
                    : qualityCheck.verdict === 'partial'
                    ? 'bg-amber-950/40 border border-amber-800/50'
                    : 'bg-red-950/40 border border-red-800/50'
                }`}>
                  <span className={`text-sm font-bold ${
                    qualityCheck.verdict === 'passed' ? 'text-emerald-300'
                    : qualityCheck.verdict === 'partial' ? 'text-amber-300'
                    : 'text-red-300'
                  }`}>
                    {qualityCheck.verdict === 'passed' ? '✅ Bestanden'
                      : qualityCheck.verdict === 'partial' ? '⚠️ Teilweise erfüllt'
                      : '❌ Nicht erfüllt'}
                  </span>
                  <span className={`text-xs font-mono font-bold ${
                    qualityCheck.overallScore >= 80 ? 'text-emerald-400'
                    : qualityCheck.overallScore >= 50 ? 'text-amber-400'
                    : 'text-red-400'
                  }`}>
                    {qualityCheck.overallScore}/100
                  </span>
                </div>

                {/* Criteria list */}
                <div className="space-y-1.5">
                  {qualityCheck.criteria.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 mt-0.5 ${c.met ? 'text-emerald-400' : 'text-red-400'}`}>
                        {c.met ? '✓' : '✗'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={c.met ? 'text-slate-300' : 'text-slate-400 line-through'}>{c.item}</span>
                        {c.notes && (
                          <p className="text-slate-600 mt-0.5 leading-relaxed">{c.notes}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[10px] px-1 rounded ${
                        c.confidence === 'high' ? 'text-slate-600 bg-slate-800'
                        : c.confidence === 'medium' ? 'text-amber-700 bg-amber-950/30'
                        : 'text-red-700 bg-red-950/30'
                      }`}>
                        {c.confidence}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Retry suggestion */}
                {qualityCheck.suggestion && qualityCheck.verdict !== 'passed' && (
                  <div className="rounded-lg border border-violet-800/40 bg-violet-950/20 px-3 py-2">
                    <p className="text-xs text-violet-300">
                      <span className="font-semibold">Verbesserungsvorschlag:</span> {qualityCheck.suggestion}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Agent Run Replay */}
        <AgentRunReplayView delegationId={id} />

        {/* Allowed Tools — collapsible expert detail */}
        {d.contract.allowedTools?.length > 0 && (
          <CollapsibleSection
            title="Erlaubte Tools"
            collapsedHint={`${d.contract.allowedTools.length} Tools`}
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-1.5">
              {d.contract.allowedTools.map(tool => (
                <span key={tool} className="px-2 py-0.5 text-xs rounded bg-gray-800 border border-gray-700 text-gray-400 font-mono">
                  {tool}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Comment Thread */}
        <DelegationCommentThread delegationId={d.id} />

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
