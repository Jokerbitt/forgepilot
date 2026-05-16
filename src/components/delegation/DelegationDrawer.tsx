'use client'

import { useState, useEffect, useRef } from 'react'
import type { Delegation, DelegationStatus, ExecutionRoute, PrivacyMode, TaskType, DelegationNote } from '@/lib/models/delegation'
import type { RiskClass } from '@/lib/models/work-item'
import { ApprovalBadge } from '@/components/shared/ApprovalBadge'

type Tab = 'details' | 'logs' | 'report' | 'notes'

const AVAILABLE_TOOLS = [
  { id: 'read_file', label: 'Dateien lesen' },
  { id: 'write_file', label: 'Dateien schreiben' },
  { id: 'search_code', label: 'Code suchen' },
  { id: 'run_command', label: 'Terminal' },
  { id: 'web_search', label: 'Web-Suche' },
  { id: 'github_api', label: 'GitHub API' },
]

const LOG_COLORS: Record<string, string> = {
  info:    'text-gray-400',
  success: 'text-green-400',
  error:   'text-red-400',
  command: 'text-blue-400 font-mono',
  thought: 'text-yellow-400 italic',
}

interface Props {
  delegation: Delegation | null
  onClose: () => void
  onUpdate: (updated: Delegation) => void
  onDelete: (id: string) => void
}

export function DelegationDrawer({ delegation, onClose, onUpdate, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('details')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Details fields
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState<DelegationStatus>('pending')
  const [executionRoute, setExecutionRoute] = useState<ExecutionRoute>('local-agent')
  const [llmModel, setLlmModel] = useState('')
  const [taskType, setTaskType] = useState<TaskType | ''>('')
  const [riskClass, setRiskClass] = useState<RiskClass>('C')
  const [definitionOfDone, setDefinitionOfDone] = useState('')
  const [maxBudgetUsd, setMaxBudgetUsd] = useState(1.0)
  const [branchStrategy, setBranchStrategy] = useState<'feature' | 'fix' | 'chore'>('feature')
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('local')
  const [allowedTools, setAllowedTools] = useState<string[]>(['read_file', 'write_file'])
  const [errorMessage, setErrorMessage] = useState('')
  const [failureFeedback, setFailureFeedback] = useState('')

  // Notes
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Report - next suggestion delegation
  const [creatingSuggestion, setCreatingSuggestion] = useState<string | null>(null)

  useEffect(() => {
    if (delegation) {
      setTab('details')
      setGoal(delegation.contract.goal)
      setStatus(delegation.status)
      setExecutionRoute(delegation.executionRoute)
      setLlmModel(delegation.contract.llmModel || '')
      setTaskType(delegation.contract.taskType || '')
      setRiskClass(delegation.contract.riskClass)
      setDefinitionOfDone((delegation.contract.definitionOfDone ?? []).join('\n'))
      setMaxBudgetUsd(delegation.contract.maxBudgetUsd)
      setBranchStrategy(delegation.contract.branchStrategy)
      setPrivacyMode(delegation.contract.privacyMode)
      setAllowedTools((delegation.contract.allowedTools ?? []).length > 0 ? delegation.contract.allowedTools : ['read_file', 'write_file'])
      setErrorMessage(delegation.errorMessage || '')
      setFailureFeedback('')
      setNoteText(delegation.note?.text || '')
      setConfirmDelete(false)
    }
  }, [delegation])

  // Live-polling while running — refresh delegation from server every 3s
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!delegation) return

    const startPolling = () => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/delegations')
          const all = await res.json() as Delegation[]
          const updated = all.find(d => d.id === delegation.id)
          if (updated && updated.updatedAt !== delegation.updatedAt) {
            onUpdate(updated)
            // Stop polling when done
            if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
              stopPolling()
            }
          }
        } catch {
          // ignore poll errors
        }
      }, 3000)
    }

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    if (delegation.status === 'running') {
      startPolling()
    } else {
      stopPolling()
    }

    return stopPolling
  }, [delegation?.id, delegation?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!delegation) return null

  const isOpen = true
  const isCompleted = delegation.status === 'completed'
  const isFailed = delegation.status === 'failed'
  const isRunning = delegation.status === 'running'
  const report = delegation.summaryReport

  const handleSave = async () => {
    setSaving(true)
    const updated: Delegation = {
      ...delegation,
      status,
      executionRoute,
      errorMessage: errorMessage || undefined,
      failureFeedback: failureFeedback || undefined,
      contract: {
        ...delegation.contract,
        goal,
        llmModel: llmModel || undefined,
        taskType: taskType ? (taskType as TaskType) : undefined,
        riskClass,
        definitionOfDone: definitionOfDone.split('\n').map(s => s.trim()).filter(Boolean),
        maxBudgetUsd,
        branchStrategy,
        privacyMode,
        allowedTools,
      },
    }
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSaving(false)
    onUpdate(updated)
  }

  const handleApprove = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    const updated: Delegation = {
      ...delegation,
      status: 'approved',
      contract: { ...delegation.contract, requiresApproval: false },
      logs: [
        ...(delegation.logs ?? []),
        { timestamp: now, type: 'success', message: 'Manuell freigegeben.' },
      ],
      updatedAt: now,
    }
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSaving(false)
    onUpdate(updated)
  }

  const handleStart = async () => {
    setSaving(true)
    const res = await fetch(`/api/delegations/${delegation.id}/execute`, { method: 'POST' })
    const data = await res.json() as { started?: boolean; mode?: string; error?: string }
    setSaving(false)
    if (data.started) {
      // Switch to logs tab and optimistically update status
      setTab('logs')
      const updated: Delegation = { ...delegation, status: 'running', updatedAt: new Date().toISOString() }
      onUpdate(updated)
    } else {
      console.error('Execute failed:', data.error)
    }
  }

  const handleRetry = async () => {
    setSaving(true)
    const context = failureFeedback.trim()
      ? `${delegation.contract.context}\n\n### KORREKTUR:\n${failureFeedback}`
      : delegation.contract.context
    const updated: Delegation = {
      ...delegation,
      status: 'pending',
      errorMessage: undefined,
      failureFeedback: failureFeedback || undefined,
      contract: { ...delegation.contract, context },
    }
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSaving(false)
    onUpdate(updated)
  }

  const handleDelete = async () => {
    await fetch(`/api/delegations?id=${delegation.id}`, { method: 'DELETE' })
    onDelete(delegation.id)
  }

  const handleSaveNote = async () => {
    setSavingNote(true)
    const note: DelegationNote = { text: noteText, updatedAt: new Date().toISOString() }
    const updated: Delegation = { ...delegation, note }
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSavingNote(false)
    onUpdate(updated)
  }

  const handleCreateSuggestion = async (suggestion: string) => {
    setCreatingSuggestion(suggestion)
    const newDelegation: Delegation = {
      id: `del-${Date.now()}`,
      status: 'pending',
      executionRoute: delegation.executionRoute,
      costEstimateUsd: 0.5,
      contract: {
        id: `con-${Date.now()}`,
        workItemId: delegation.contract.workItemId,
        goal: suggestion,
        context: `Folge-Delegation aus: ${delegation.contract.goal}`,
        definitionOfDone: ['Task abgeschlossen'],
        riskClass: 'A',
        maxBudgetUsd: 1.0,
        allowedTools: ['read_file', 'write_file'],
        branchStrategy: 'feature',
        requiresApproval: false,
        privacyMode: delegation.contract.privacyMode,
        llmModel: delegation.contract.llmModel,
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDelegation),
    })
    setCreatingSuggestion(null)
    onClose()
  }

  const TABS: { id: Tab; label: string; show: boolean }[] = [
    { id: 'details', label: '✏ Details', show: true },
    { id: 'logs', label: '📋 Logs', show: !!(delegation.logs && delegation.logs.length > 0) || isRunning },
    { id: 'report', label: '📄 Report', show: isCompleted && !!report },
    { id: 'notes', label: '📝 Notizen', show: true },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <header className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">{delegation.contract.workItemId}</span>
              <ApprovalBadge
                requiresApproval={delegation.contract.requiresApproval}
                riskClass={delegation.contract.riskClass}
              />
            </div>
            <h2 className={`text-lg font-bold leading-tight ${
              isCompleted ? 'line-through text-gray-500 decoration-green-500/60 decoration-2' :
              delegation.status === 'cancelled' ? 'line-through text-gray-600' :
              isFailed ? 'line-through text-red-400/70' : 'text-white'
            }`}>
              {delegation.contract.goal}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors flex-shrink-0 mt-1">
            ✕
          </button>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 bg-gray-900 flex-shrink-0 px-2">
          {TABS.filter(t => t.show).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? 'text-blue-400 border-blue-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── DETAILS TAB ── */}
          {tab === 'details' && (
            <div className="p-6 space-y-5">

              {/* Failed banner */}
              {isFailed && (
                <div className="bg-red-950/50 border border-red-900 rounded-lg p-4 space-y-3">
                  <div className="text-red-400 font-bold text-sm flex items-center gap-2">⚠ Letzter Fehler</div>
                  <p className="text-xs text-red-300/80 font-mono break-all">
                    {errorMessage || 'Unbekannter Fehler'}
                  </p>
                  <textarea
                    value={failureFeedback}
                    onChange={e => setFailureFeedback(e.target.value)}
                    placeholder="Was soll der Agent anders machen?"
                    className="w-full bg-red-950/30 border border-red-900/50 rounded p-2 text-red-200 text-sm resize-none h-16 focus:outline-none focus:border-red-400"
                  />
                  <button
                    onClick={handleRetry}
                    disabled={saving}
                    className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
                  >
                    🔄 Erneut starten
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ziel</label>
                <textarea
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white text-sm resize-none h-20 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-lg border border-gray-800 bg-gray-900 p-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Freigabe</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <ApprovalBadge
                      requiresApproval={delegation.contract.requiresApproval}
                      riskClass={riskClass}
                    />
                    <span className="text-xs text-gray-500">
                      {riskClass === 'C'
                        ? 'Kritische Aufgaben brauchen bewusstes Review.'
                        : delegation.contract.requiresApproval
                          ? 'Diese Delegation wartet auf eine Freigabe.'
                          : 'Diese Delegation darf automatisch weiterlaufen.'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as DelegationStatus)}
                    disabled={isRunning}
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-60"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="running">Running</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Task-Typ</label>
                  <select
                    value={taskType}
                    onChange={e => setTaskType(e.target.value as TaskType | '')}
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Kein Typ</option>
                    <option value="feature">✨ Feature</option>
                    <option value="bugfix">🐛 Bugfix</option>
                    <option value="docs">📝 Docs</option>
                    <option value="refactor">♻️ Refactor</option>
                    <option value="research">🔍 Research</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modell</label>
                  <input
                    type="text"
                    value={llmModel}
                    onChange={e => setLlmModel(e.target.value)}
                    placeholder="claude-sonnet"
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Budget ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={maxBudgetUsd}
                    onChange={e => setMaxBudgetUsd(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Risk Class</label>
                  <select
                    value={riskClass}
                    onChange={e => setRiskClass(e.target.value as RiskClass)}
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="A">A — Gering</option>
                    <option value="B">B — Moderat</option>
                    <option value="C">C — Kritisch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Branch</label>
                  <select
                    value={branchStrategy}
                    onChange={e => setBranchStrategy(e.target.value as 'feature' | 'fix' | 'chore')}
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="feature">feature/</option>
                    <option value="fix">fix/</option>
                    <option value="chore">chore/</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Definition of Done</label>
                <textarea
                  value={definitionOfDone}
                  onChange={e => setDefinitionOfDone(e.target.value)}
                  placeholder="Eine Zeile pro Kriterium..."
                  className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white text-sm resize-none h-24 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tools</label>
                <div className="grid grid-cols-2 gap-2 bg-gray-900 border border-gray-800 rounded p-3">
                  {AVAILABLE_TOOLS.map(tool => (
                    <label key={tool.id} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        allowedTools.includes(tool.id) ? 'bg-blue-600 border-blue-600' : 'bg-gray-800 border-gray-600'
                      }`}>
                        {allowedTools.includes(tool.id) && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <span className="text-xs text-gray-300 group-hover:text-white">{tool.label}</span>
                      <input type="checkbox" className="sr-only" checked={allowedTools.includes(tool.id)}
                        onChange={() => setAllowedTools(prev =>
                          prev.includes(tool.id) ? prev.filter(t => t !== tool.id) : [...prev, tool.id]
                        )}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── LOGS TAB ── */}
          {tab === 'logs' && (
            <div className="p-4 flex flex-col h-full">
              {isRunning && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-950/40 border border-blue-900/50 rounded text-xs text-blue-400">
                  <span className="animate-pulse">●</span>
                  <span>Agent läuft — Logs werden live aktualisiert...</span>
                </div>
              )}
              {delegation.logs && delegation.logs.length > 0 ? (
                <LogsScroller logs={delegation.logs} isRunning={isRunning} />
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-sm">{isRunning ? 'Warte auf erste Logs...' : 'Keine Logs vorhanden'}</p>
                </div>
              )}
            </div>
          )}

          {/* ── REPORT TAB ── */}
          {tab === 'report' && report && (
            <div className="p-6 space-y-6">

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
                  <div className="text-2xl font-bold text-white">{report.timeTakenMinutes}<span className="text-sm text-gray-500">m</span></div>
                  <div className="text-xs text-gray-500 mt-1">Dauer</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
                  <div className="text-2xl font-bold text-green-400">
                    {(report.filesAdded?.length || 0) + (report.filesModified?.length || 0) + (report.filesDeleted?.length || 0) || report.changes.length}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Dateien</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
                  <div className="text-2xl font-bold text-white font-mono">
                    ${(delegation.actualCostUsd ?? delegation.costEstimateUsd).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Kosten</div>
                </div>
              </div>

              {/* Lines / Tests */}
              {(report.linesAdded !== undefined || report.testsAdded !== undefined) && (
                <div className="flex gap-4 text-sm">
                  {report.linesAdded !== undefined && (
                    <span className="text-green-400">+{report.linesAdded} Zeilen</span>
                  )}
                  {report.linesRemoved !== undefined && (
                    <span className="text-red-400">-{report.linesRemoved} Zeilen</span>
                  )}
                  {report.testsAdded !== undefined && (
                    <span className="text-blue-400">{report.testsAdded} neue Tests</span>
                  )}
                  {report.testsPassed !== undefined && (
                    <span className="text-green-400">✓ {report.testsPassed} bestanden</span>
                  )}
                </div>
              )}

              {/* PR Link */}
              {report.prUrl && (
                <a href={report.prUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm bg-blue-900/20 border border-blue-900/40 rounded-lg p-3 transition-colors"
                >
                  <span>🔗</span>
                  <span>Pull Request ansehen</span>
                  <span className="ml-auto">↗</span>
                </a>
              )}

              {/* Key Points */}
              {report.keyPoints.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-2">Was wurde gemacht</h3>
                  <ul className="space-y-2">
                    {report.keyPoints.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-300">
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">💡</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Files */}
              {(report.filesAdded?.length || report.filesModified?.length || report.filesDeleted?.length || report.changes.length > 0) && (
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-2">Geänderte Dateien</h3>
                  <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                    {(report.filesAdded || []).map((f, i) => (
                      <div key={`a-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs font-mono border-b border-gray-800 last:border-0">
                        <span className="text-green-400 w-4">+</span>
                        <span className="text-gray-300">{f}</span>
                        <span className="ml-auto text-gray-600 text-[10px]">NEU</span>
                      </div>
                    ))}
                    {(report.filesModified || report.changes.filter(c => !c.includes('[NEW]') && !c.includes('[DEL]'))).map((f, i) => (
                      <div key={`m-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs font-mono border-b border-gray-800 last:border-0">
                        <span className="text-blue-400 w-4">~</span>
                        <span className="text-gray-300">{typeof f === 'string' ? f.replace(/\[MOD\]|\[NEW\]|\[DEL\]/g, '').trim() : f}</span>
                      </div>
                    ))}
                    {(report.filesDeleted || []).map((f, i) => (
                      <div key={`d-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs font-mono border-b border-gray-800 last:border-0">
                        <span className="text-red-400 w-4">-</span>
                        <span className="text-gray-300 line-through">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {report.warnings && report.warnings.length > 0 && (
                <div className="bg-yellow-950/30 border border-yellow-900/40 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-bold text-yellow-500 uppercase mb-2">Agent-Hinweise</div>
                  {report.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-yellow-300/80">⚠ {w}</p>
                  ))}
                </div>
              )}

              {/* Next Suggestions */}
              {report.nextSuggestions && report.nextSuggestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-2">Agent schlägt vor</h3>
                  <div className="space-y-2">
                    {report.nextSuggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
                        <span className="text-blue-400 text-sm flex-shrink-0">→</span>
                        <span className="text-sm text-gray-300 flex-1">{s}</span>
                        <button
                          onClick={() => handleCreateSuggestion(s)}
                          disabled={creatingSuggestion === s}
                          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-bold transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          {creatingSuggestion === s ? '...' : '⚡ Delegieren'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── NOTES TAB ── */}
          {tab === 'notes' && (
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Persönliche Notizen zu dieser Delegation. Markdown wird unterstützt.</p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Notiz eingeben... (z.B. 'Zurückgestellt weil X' oder 'Achtung: Produktions-DB!')"
                className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white text-sm resize-none h-48 focus:border-blue-500 focus:outline-none"
              />
              {delegation.note?.updatedAt && (
                <p className="text-xs text-gray-600">
                  Zuletzt bearbeitet: {new Date(delegation.note.updatedAt).toLocaleString('de-DE')}
                </p>
              )}
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                {savingNote ? 'Gespeichert ✓' : 'Notiz speichern'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex items-center gap-2 flex-shrink-0">
          {/* Delete with confirm */}
          {confirmDelete ? (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-900 rounded px-3 py-2 flex-1">
              <span className="text-red-400 text-xs flex-1">Wirklich löschen?</span>
              <button onClick={handleDelete} className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold">Ja</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-white px-2 py-1">Nein</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-gray-600 hover:text-red-400 transition-colors"
                title="Löschen"
              >
                🗑
              </button>
              <div className="flex-1" />
              <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
                Schließen
              </button>
              {/* Context-sensitive action buttons */}
              {tab === 'details' && delegation.status === 'pending' && (
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors shadow-lg shadow-green-900/30"
                >
                  {saving ? '...' : '✓ Freigeben'}
                </button>
              )}
              {tab === 'details' && delegation.status === 'approved' && (
                <button
                  onClick={handleStart}
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors shadow-lg shadow-blue-900/30"
                >
                  {saving ? '⏳ Startet...' : '▶ Starten'}
                </button>
              )}
              {tab === 'details' && !['pending', 'approved'].includes(delegation.status) && (
                <button
                  onClick={handleSave}
                  disabled={saving || isRunning}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors"
                >
                  {saving ? 'Speichert...' : 'Speichern'}
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </>
  )
}

// ── Auto-scrolling logs viewer ──────────────────────────────────────────────
import type { AgentLog } from '@/lib/models/delegation'

function LogsScroller({ logs, isRunning }: { logs: AgentLog[]; isRunning: boolean }) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isRunning && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, isRunning])

  return (
    <div className="space-y-1 overflow-y-auto flex-1 font-mono text-xs">
      {logs.map((log, i) => (
        <div key={i} className="flex gap-3">
          <span className="text-gray-600 flex-shrink-0">
            {new Date(log.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={LOG_COLORS[log.type] || 'text-gray-400'}>
            {log.type === 'command' ? '› ' : log.type === 'thought' ? '💭 ' : ''}{log.message}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
