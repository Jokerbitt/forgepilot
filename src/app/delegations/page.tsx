'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'
import { DelegationDrawer } from '@/components/delegation/DelegationDrawer'
import { ElapsedTimer, formatCompletedDuration } from '@/components/shared/ElapsedTimer'
import { NewDelegationDialog } from '@/components/delegation/NewDelegationDialog'
import { ApprovalBadge } from '@/components/shared/ApprovalBadge'

type ApprovalFilter = 'Alle' | 'approval-required' | 'auto-approved' | 'risk-blocked'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-900/50 text-yellow-500 border-yellow-700',
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

const GOAL_STYLE: Record<string, string> = {
  pending:   'text-gray-200',
  approved:  'text-gray-200',
  running:   'text-gray-200',
  completed: 'line-through text-gray-500 decoration-green-500/50 decoration-2',
  failed:    'line-through text-red-400/60 decoration-red-600/60',
  cancelled: 'line-through text-gray-600',
}

const APPROVAL_FILTER_LABELS: Record<ApprovalFilter, string> = {
  Alle: 'Alle',
  'approval-required': 'Freigabe noetig',
  'auto-approved': 'Auto-freigegeben',
  'risk-blocked': 'RiskClass C',
}

const TASK_TYPE_ICONS: Record<string, string> = {
  feature:  '✨',
  bugfix:   '🐛',
  docs:     '📝',
  refactor: '♻️',
  research: '🔍',
}

// ── Age helper (used in Zeit column for waiting delegations) ─────────────
function formatAge(createdAt: string): { text: string; colorClass: string } {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageMin = Math.floor(ageMs / 60000)
  const ageH   = Math.floor(ageMin / 60)
  const ageD   = Math.floor(ageH / 24)
  if (ageD >= 1)   return { text: `${ageD}d alt`,  colorClass: 'text-red-400' }
  if (ageH >= 4)   return { text: `${ageH}h alt`,  colorClass: 'text-yellow-500' }
  if (ageMin >= 30) return { text: `${ageMin}m alt`, colorClass: 'text-yellow-600/70' }
  return { text: `${ageMin}m alt`, colorClass: 'text-gray-600' }
}

function DelegationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDelegation, setSelectedDelegation] = useState<Delegation | null>(null)
  // ?new=1 auto-opens the dialog on mount
  const [showNewDialog, setShowNewDialog] = useState(searchParams.get('new') === '1')

  // Filters — initialised from URL params
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'Alle')
  const [projectFilter, setProjectFilter] = useState<string>(searchParams.get('project') ?? 'Alle')
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>((searchParams.get('approval') as ApprovalFilter) ?? 'Alle')
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') ?? '')

  // Sync filters → URL (replace, no history entry)
  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'Alle')   params.set('status',   statusFilter)
    if (projectFilter !== 'Alle')  params.set('project',  projectFilter)
    if (approvalFilter !== 'Alle') params.set('approval', approvalFilter)
    if (searchQuery)               params.set('q',        searchQuery)
    const qs = params.toString()
    router.replace(qs ? `/delegations?${qs}` : '/delegations', { scroll: false })
  }, [statusFilter, projectFilter, approvalFilter, searchQuery, router])

  // Sort
  type SortKey = 'goal' | 'status' | 'time' | 'cost'
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Drag & Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Inline delete confirm in table row
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Refs for keyboard shortcut targets
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const loadDelegations = useCallback(() => {
    fetch('/api/delegations')
      .then(res => res.json())
      .then(data => {
        const sorted = (data || []).sort((a: Delegation, b: Delegation) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        // Only update state if data actually changed — prevents re-renders that
        // interrupt click events (mousedown → re-render → mouseup on different node)
        setDelegations(prev => {
          const prevKey = prev.map(d => `${d.id}:${d.status}:${d.updatedAt}`).join(',')
          const nextKey = sorted.map((d: Delegation) => `${d.id}:${d.status}:${d.updatedAt}`).join(',')
          return prevKey === nextKey ? prev : sorted
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadDelegations()
  }, [loadDelegations])

  // Poll every 5 s when any delegation is running
  // Longer interval = fewer re-renders = fewer interrupted click events
  useEffect(() => {
    const hasRunning = delegations.some(d => d.status === 'running')
    if (!hasRunning) return
    const interval = setInterval(loadDelegations, 5000)
    return () => clearInterval(interval)
  }, [delegations, loadDelegations])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement
      const isInputFocused = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement
      if (isInputFocused) return

      if (e.key === 'Escape') {
        if (selectedDelegation) { setSelectedDelegation(null); return }
        if (showNewDialog) { setShowNewDialog(false); return }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setShowNewDialog(true)
      } else if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedDelegation, showNewDialog])

  // ── Optimistic helpers ──────────────────────────────────────────────────
  const applyUpdate = useCallback((updated: Delegation) => {
    setDelegations(prev => prev.map(d => d.id === updated.id ? updated : d))
    // keep drawer in sync
    setSelectedDelegation(prev => prev?.id === updated.id ? updated : prev)
  }, [])

  const applyDelete = useCallback((id: string) => {
    setDelegations(prev => prev.filter(d => d.id !== id))
    setSelectedDelegation(prev => prev?.id === id ? null : prev)
  }, [])

  const applyAdd = useCallback((newDel: Delegation) => {
    setDelegations(prev => [newDel, ...prev])
  }, [])

  // ── Status change (Cancel / Stop / Retry) ───────────────────────────────
  const handleStatusChange = async (id: string, newStatus: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const delegation = delegations.find(d => d.id === id)
    if (!delegation) return

    const updateData: Delegation = { ...delegation, status: newStatus as Delegation['status'] }

    // Attach a demo report when completing manually
    if (newStatus === 'completed' && !delegation.summaryReport) {
      updateData.summaryReport = {
        keyPoints: ['Code refactored', 'Unit tests pass 100%', 'No linting errors found'],
        changes: ['[MOD] src/app/page.tsx'],
        timeTakenMinutes: Math.max(1, Math.round((Date.now() - new Date(delegation.createdAt).getTime()) / 60000)),
      }
    }

    applyUpdate(updateData)
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    })
  }

  const handleApproveDelegation = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const delegation = delegations.find(d => d.id === id)
    if (!delegation || delegation.contract.riskClass === 'C') return

    const now = new Date().toISOString()
    const updateData: Delegation = {
      ...delegation,
      status: 'approved',
      contract: {
        ...delegation.contract,
        requiresApproval: false,
      },
      logs: [
        ...(delegation.logs ?? []),
        { timestamp: now, type: 'success', message: 'Manuell freigegeben.' },
      ],
      updatedAt: now,
    }

    applyUpdate(updateData)
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    })
  }

  const handleStartDelegation = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const delegation = delegations.find(d => d.id === id)
    if (!delegation || delegation.status !== 'approved') return
    // Optimistic update
    applyUpdate({ ...delegation, status: 'running', updatedAt: new Date().toISOString() })
    await fetch(`/api/delegations/${id}/execute`, { method: 'POST' })
  }

  const handleCancelRunning = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const delegation = delegations.find(d => d.id === id)
    if (!delegation) return
    applyUpdate({ ...delegation, status: 'cancelled', updatedAt: new Date().toISOString() })
    await fetch(`/api/delegations/${id}/cancel`, { method: 'POST' })
  }

  const handleRowDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await fetch(`/api/delegations?id=${id}`, { method: 'DELETE' })
    applyDelete(id)
    setConfirmDeleteId(null)
  }

  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const handleBulkDeleteCompleted = async () => {
    const terminalIds = delegations
      .filter(d => d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled')
      .map(d => d.id)
    await fetch('/api/delegations?statuses=completed,failed,cancelled', { method: 'DELETE' })
    setDelegations(prev => prev.filter(d => !terminalIds.includes(d.id)))
    setConfirmBulkDelete(false)
  }

  const terminalCount = delegations.filter(
    d => d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled'
  ).length

  // ── Batch Approve ────────────────────────────────────────────────────────
  const approvableDelegations = delegations.filter(
    d => d.status === 'pending' && d.contract.requiresApproval && d.contract.riskClass !== 'C'
  )
  const approvableCount = approvableDelegations.length

  const handleBatchApprove = async () => {
    if (approvableCount === 0) return
    const now = new Date().toISOString()
    const updates = approvableDelegations.map(d => ({
      ...d,
      status: 'approved' as const,
      contract: { ...d.contract, requiresApproval: false },
      logs: [...(d.logs ?? []), { timestamp: now, type: 'success', message: 'Batch-freigegeben.' }],
      updatedAt: now,
    }))
    // Optimistic update
    updates.forEach(applyUpdate)
    // Bulk persist
    await fetch('/api/delegations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────
  const handleDragStart = (index: number) => setDraggedIndex(index)

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    const next = [...delegations]
    const item = next[draggedIndex]
    next.splice(draggedIndex, 1)
    next.splice(index, 0, item)
    setDelegations(next)
    setDraggedIndex(index)
  }

  const handleDrop = () => setDraggedIndex(null)

  // ── CSV Export ──────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const rows = sortedDelegations
    const header = ['ID', 'Ticket', 'Ziel', 'Status', 'RiskClass', 'Route', 'Budget ($)', 'Tatsächlich ($)', 'Erstellt', 'Aktualisiert']
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const lines = [
      header.map(escape).join(','),
      ...rows.map(d => [
        d.id,
        d.contract.workItemId,
        d.contract.goal,
        d.status,
        d.contract.riskClass,
        d.executionRoute,
        d.contract.maxBudgetUsd.toFixed(2),
        d.actualCostUsd != null ? d.actualCostUsd.toFixed(4) : '',
        new Date(d.createdAt).toLocaleString('de-DE'),
        new Date(d.updatedAt).toLocaleString('de-DE'),
      ].map(escape).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forgepilot-delegations-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filters ─────────────────────────────────────────────────────────────
  const uniqueProjects = Array.from(
    new Set(delegations.map(d => d.contract.workItemId.split('-')[0] || 'Unknown'))
  ).sort()

  const filteredDelegations = delegations.filter(d => {
    const matchStatus  = statusFilter === 'Alle' || d.status === statusFilter
    const matchProject = projectFilter === 'Alle' || d.contract.workItemId.startsWith(projectFilter)
    const matchApproval =
      approvalFilter === 'Alle' ||
      (approvalFilter === 'approval-required' && d.contract.requiresApproval) ||
      (approvalFilter === 'auto-approved' && !d.contract.requiresApproval) ||
      (approvalFilter === 'risk-blocked' && d.contract.riskClass === 'C')
    const q = searchQuery.toLowerCase().trim()
    const matchSearch = !q ||
      d.contract.goal.toLowerCase().includes(q) ||
      d.contract.workItemId.toLowerCase().includes(q) ||
      (d.contract.context || '').toLowerCase().includes(q)

    return matchStatus && matchProject && matchApproval && matchSearch
  })

  const STATUS_SORT_WEIGHT: Record<string, number> = {
    running: 0, approved: 1, pending: 2, completed: 3, failed: 4, cancelled: 5,
  }

  const sortedDelegations = sortKey
    ? [...filteredDelegations].sort((a, b) => {
        let cmp = 0
        if (sortKey === 'goal') {
          cmp = a.contract.goal.localeCompare(b.contract.goal, 'de')
        } else if (sortKey === 'status') {
          cmp = (STATUS_SORT_WEIGHT[a.status] ?? 9) - (STATUS_SORT_WEIGHT[b.status] ?? 9)
        } else if (sortKey === 'time') {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        } else if (sortKey === 'cost') {
          const ca = a.actualCostUsd ?? a.costEstimateUsd ?? 0
          const cb = b.actualCostUsd ?? b.costEstimateUsd ?? 0
          cmp = ca - cb
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filteredDelegations

  const runningCount = delegations.filter(d => d.status === 'running').length
  const pendingCount = delegations.filter(d => d.status === 'pending').length
  const completedCount = delegations.filter(d => d.status === 'completed').length
  const approvalRequiredCount = delegations.filter(d => d.contract.requiresApproval).length
  const autoApprovedCount = delegations.filter(d => !d.contract.requiresApproval).length
  const riskBlockedCount = delegations.filter(d => d.contract.riskClass === 'C').length

  // Cost stats
  const totalEstimated = delegations.reduce((sum, d) => sum + (d.costEstimateUsd || 0), 0)
  const totalActual = delegations
    .filter(d => d.actualCostUsd != null)
    .reduce((sum, d) => sum + (d.actualCostUsd ?? 0), 0)
  const hasActualCosts = delegations.some(d => d.actualCostUsd != null)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="flex flex-wrap justify-between items-start gap-4 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span>📋</span> Delegation Center
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {runningCount > 0 && (
                <span className="text-green-400 font-medium">{runningCount} läuft • </span>
              )}
              {pendingCount > 0 && (
                <span className="text-yellow-400 font-medium">{pendingCount} ausstehend • </span>
              )}
              {approvalRequiredCount > 0 && (
                <span className="text-yellow-400 font-medium">{approvalRequiredCount} Freigabe noetig • </span>
              )}
              {delegations.length} Delegation{delegations.length !== 1 ? 'en' : ''} gesamt
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Bulk delete confirm */}
            {terminalCount > 0 && (
              confirmBulkDelete ? (
                <div className="flex items-center gap-2 bg-red-950/60 border border-red-900 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-red-300">{terminalCount} löschen?</span>
                  <button
                    onClick={handleBulkDeleteCompleted}
                    className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded font-bold transition-colors"
                  >
                    Ja
                  </button>
                  <button
                    onClick={() => setConfirmBulkDelete(false)}
                    className="text-xs text-gray-400 hover:text-white px-1 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="text-xs text-gray-500 hover:text-red-400 border border-gray-800 hover:border-red-900/50 px-3 py-2 rounded-lg transition-colors"
                  title={`${terminalCount} abgeschlossene Delegationen löschen`}
                >
                  🗑 Aufräumen ({terminalCount})
                </button>
              )
            )}
            {/* Batch Approve — all approvable pending delegations */}
            {approvableCount > 0 && (
              <button
                onClick={handleBatchApprove}
                className="text-xs text-green-400 hover:text-green-300 border border-green-900/60 hover:border-green-700 hover:bg-green-900/20 px-3 py-2 rounded-lg transition-colors"
                title={`${approvableCount} Delegation${approvableCount !== 1 ? 'en' : ''} auf einmal freigeben`}
              >
                ✔ Alle freigeben ({approvableCount})
              </button>
            )}
            {delegations.length > 0 && (
              <button
                onClick={handleExportCsv}
                className="text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 px-3 py-2 rounded-lg transition-colors"
                title="Aktuelle Ansicht als CSV exportieren"
              >
                ↓ CSV
              </button>
            )}
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
              title="Neue Delegation erstellen [N]"
            >
              <span>+</span> Neue Delegation
              <kbd className="hidden sm:inline text-[10px] bg-blue-800/60 px-1 py-0.5 rounded font-mono leading-none">N</kbd>
            </button>
          </div>
        </header>

        {/* ── Cost / Stats Summary ──────────────────────────────────── */}
        {!loading && delegations.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{delegations.length}</div>
              <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Gesamt</div>
            </div>
            <div className={`bg-gray-900 border rounded-xl p-4 text-center ${runningCount > 0 ? 'border-green-800/60' : 'border-gray-800'}`}>
              <div className={`text-2xl font-bold ${runningCount > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                {runningCount > 0 ? runningCount : completedCount}
              </div>
              <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                {runningCount > 0 ? 'Laufend' : 'Abgeschlossen'}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white font-mono">
                ${totalEstimated.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Geschätzt</div>
            </div>
            <div className={`bg-gray-900 border rounded-xl p-4 text-center ${hasActualCosts ? 'border-yellow-900/50' : 'border-gray-800'}`}>
              <div className={`text-2xl font-bold font-mono ${hasActualCosts ? 'text-yellow-400' : 'text-gray-600'}`}>
                {hasActualCosts ? `$${totalActual.toFixed(4)}` : '–'}
              </div>
              <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Tatsächlich</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-14 bg-gray-900 rounded-xl border border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : delegations.length === 0 ? (
          <div className="bg-gray-900 p-10 rounded-xl border border-gray-800 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="text-lg text-gray-400 mb-2">Noch keine Delegationen</h3>
            <p className="text-gray-600 text-sm mb-5">
              Delegiere Aufgaben vom Dashboard oder erstelle direkt eine neue Delegation.
            </p>
            <button
              onClick={() => setShowNewDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              + Erste Delegation erstellen
            </button>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── Filters ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-4 items-center bg-gray-900 p-3 rounded-xl border border-gray-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-500 mr-1 uppercase tracking-wide">Status</span>
                {['Alle', 'running', 'pending', 'approved', 'completed', 'failed', 'cancelled'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                    }`}
                  >
                    {s === 'Alle' ? 'Alle' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pl-4 border-l border-gray-800">
                <span className="text-xs text-gray-500 mr-1 uppercase tracking-wide">Freigabe</span>
                {(['Alle', 'approval-required', 'auto-approved', 'risk-blocked'] as ApprovalFilter[]).map(filter => {
                  const count =
                    filter === 'approval-required' ? approvalRequiredCount :
                    filter === 'auto-approved' ? autoApprovedCount :
                    filter === 'risk-blocked' ? riskBlockedCount :
                    delegations.length

                  return (
                    <button
                      key={filter}
                      onClick={() => setApprovalFilter(filter)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        approvalFilter === filter
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      {APPROVAL_FILTER_LABELS[filter]} ({count})
                    </button>
                  )
                })}
              </div>

              {/* Search input */}
              <div className="flex items-center gap-2 pl-4 border-l border-gray-800 ml-auto">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Suchen… [/]"
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-44 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    title="Suche leeren"
                  >
                    ✕
                  </button>
                )}
              </div>

              {uniqueProjects.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-4 border-l border-gray-800">
                  <span className="text-xs text-gray-500 mr-1 uppercase tracking-wide">Projekt</span>
                  <button
                    onClick={() => setProjectFilter('Alle')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      projectFilter === 'Alle'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                    }`}
                  >
                    Alle
                  </button>
                  {uniqueProjects.map(p => (
                    <button
                      key={p}
                      onClick={() => setProjectFilter(p)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        projectFilter === p
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Table ───────────────────────────────────────────────── */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-950 border-b border-gray-800 text-xs uppercase text-gray-500">
                      <th className="p-3 font-medium w-10 text-center">#</th>
                      <th
                        className="p-3 font-medium cursor-pointer hover:text-gray-300 select-none"
                        onClick={() => handleSort('goal')}
                      >
                        Ticket / Ziel {sortKey === 'goal' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">⇅</span>}
                      </th>
                      <th className="p-3 font-medium hidden md:table-cell">Agent</th>
                      <th
                        className="p-3 font-medium cursor-pointer hover:text-gray-300 select-none"
                        onClick={() => handleSort('status')}
                      >
                        Status {sortKey === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">⇅</span>}
                      </th>
                      <th
                        className="p-3 font-medium hidden sm:table-cell cursor-pointer hover:text-gray-300 select-none"
                        onClick={() => handleSort('time')}
                      >
                        Zeit {sortKey === 'time' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">⇅</span>}
                      </th>
                      <th className="p-3 font-medium text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/70">
                    {sortedDelegations.map((del, index) => {
                      const isDone = del.status === 'completed' || del.status === 'failed' || del.status === 'cancelled'
                      const canCancel = del.status === 'pending' || del.status === 'approved'
                      const canDelete = isDone
                      const canApprove = del.status === 'pending' && del.contract.requiresApproval && del.contract.riskClass !== 'C'
                      const canStart = del.status === 'approved'

                      return (
                        <tr
                          key={del.id}
                          className={`hover:bg-gray-800/40 transition-colors group cursor-pointer ${
                            draggedIndex === index ? 'opacity-40 bg-gray-800' : ''
                          }`}
                          onDragOver={draggedIndex !== null ? e => handleDragOver(e, index) : undefined}
                          onDragEnd={draggedIndex !== null ? handleDrop : undefined}
                          onClick={() => setSelectedDelegation(del)}
                        >
                          {/* Priority / drag handle — draggable only on this cell */}
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            {!isDone ? (
                              <span
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                className="text-xs text-gray-600 cursor-grab group-hover:text-gray-400 transition-colors select-none px-1 py-0.5"
                              >
                                ⋮⋮
                              </span>
                            ) : (
                              <span className="text-xs text-gray-700">-</span>
                            )}
                          </td>

                          {/* Ticket / Goal */}
                          <td className="p-3">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-gray-600 font-mono">{del.contract.workItemId}</span>
                              {del.contract.branchStrategy && TASK_TYPE_ICONS[del.contract.branchStrategy] && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400"
                                  title={del.contract.branchStrategy}
                                >
                                  {TASK_TYPE_ICONS[del.contract.branchStrategy]} {del.contract.branchStrategy}
                                </span>
                              )}
                              <ApprovalBadge
                                requiresApproval={del.contract.requiresApproval}
                                riskClass={del.contract.riskClass}
                                compact
                              />
                            </div>
                            <div className={`text-sm font-medium ${GOAL_STYLE[del.status] || 'text-gray-200'}`}>
                              {del.contract.goal}
                            </div>
                            {del.note?.text && (
                              <div className="text-xs text-yellow-400/70 mt-0.5 truncate max-w-xs">
                                📝 {del.note.text}
                              </div>
                            )}
                          </td>

                          {/* Agent */}
                          <td className="p-3 hidden md:table-cell">
                            <div className="text-xs text-gray-400">{del.executionRoute}</div>
                            {del.contract.llmModel && (
                              <div className="text-xs text-gray-600 mt-0.5">🧠 {del.contract.llmModel}</div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs rounded-md border font-medium uppercase tracking-wider whitespace-nowrap ${
                              STATUS_COLORS[del.status] || STATUS_COLORS.pending
                            }`}>
                              {STATUS_LABELS[del.status] || del.status}
                            </span>
                          </td>

                          {/* Time */}
                          <td className="p-3 hidden sm:table-cell">
                            {del.status === 'running' ? (
                              <div>
                                <ElapsedTimer startedAt={del.updatedAt || del.createdAt} className="text-xs text-green-400 font-mono" />
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {new Date(del.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            ) : del.status === 'completed' && del.summaryReport ? (
                              <div>
                                <div className="text-xs text-green-400/70 font-mono">
                                  {formatCompletedDuration(del.createdAt, del.updatedAt)}
                                </div>
                                {del.actualCostUsd != null ? (
                                  <div className="text-xs text-yellow-600/80 font-mono mt-0.5">
                                    ${del.actualCostUsd.toFixed(4)}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-600 mt-0.5">
                                    {new Date(del.updatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                  </div>
                                )}
                              </div>
                            ) : (del.status === 'pending' || del.status === 'approved') ? (() => {
                              const age = formatAge(del.createdAt)
                              return (
                                <div>
                                  <div className={`text-xs font-mono font-medium ${age.colorClass}`} title="Wartezeit seit Erstellung">
                                    ⏳ {age.text}
                                  </div>
                                  <div className="text-xs text-gray-700 mt-0.5">
                                    {new Date(del.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              )
                            })() : (
                              <div className="text-xs text-gray-600">
                                {new Date(del.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end items-center gap-1">

                              {/* Inline delete confirm */}
                              {confirmDeleteId === del.id ? (
                                <div className="flex items-center gap-1 bg-red-950/60 border border-red-900 rounded px-2 py-1">
                                  <span className="text-red-400 text-xs">Löschen?</span>
                                  <button
                                    onClick={e => handleRowDelete(del.id, e)}
                                    className="text-xs text-white bg-red-600 hover:bg-red-500 px-2 py-0.5 rounded font-bold transition-colors"
                                  >
                                    Ja
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                                    className="text-xs text-gray-400 hover:text-white px-1 transition-colors"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {/* Approve waiting Class A/B delegations */}
                                  {canApprove && (
                                    <button
                                      onClick={e => handleApproveDelegation(del.id, e)}
                                      className="text-xs bg-green-900/50 text-green-300 hover:bg-green-900 px-2 py-1 rounded border border-green-800/70 transition-colors"
                                      title="Freigeben"
                                    >
                                      Freigeben
                                    </button>
                                  )}

                                  {/* Start — approved delegations */}
                                  {canStart && (
                                    <button
                                      onClick={e => handleStartDelegation(del.id, e)}
                                      className="text-xs bg-blue-900/50 text-blue-300 hover:bg-blue-900 px-2 py-1 rounded border border-blue-800/70 transition-colors font-medium"
                                      title="Agent starten"
                                    >
                                      ▶
                                    </button>
                                  )}

                                  {/* Cancel — for pending/approved */}
                                  {canCancel && (
                                    <button
                                      onClick={e => handleStatusChange(del.id, 'cancelled', e)}
                                      className="text-xs text-gray-500 hover:text-yellow-400 px-2 py-1 rounded hover:bg-yellow-900/20 transition-colors"
                                      title="Abbrechen"
                                    >
                                      ✕
                                    </button>
                                  )}

                                  {/* Stop running — calls cancel API */}
                                  {del.status === 'running' && (
                                    <button
                                      onClick={e => handleCancelRunning(del.id, e)}
                                      className="text-xs bg-red-900/50 text-red-400 hover:text-red-300 hover:bg-red-900 px-2 py-1 rounded border border-red-900/50 transition-colors"
                                      title="Stoppen"
                                    >
                                      ⛔
                                    </button>
                                  )}

                                  {/* Mark complete (running) */}
                                  {del.status === 'running' && (
                                    <button
                                      onClick={e => handleStatusChange(del.id, 'completed', e)}
                                      className="text-xs bg-green-900/50 text-green-400 hover:bg-green-900 px-2 py-1 rounded border border-green-900/50 transition-colors"
                                      title="Abschließen"
                                    >
                                      ✓
                                    </button>
                                  )}

                                  {/* Retry — failed/cancelled */}
                                  {(del.status === 'failed' || del.status === 'cancelled') && (
                                    <button
                                      onClick={e => handleStatusChange(del.id, 'pending', e)}
                                      className="text-xs bg-blue-900/50 text-blue-400 hover:bg-blue-900 px-2 py-1 rounded border border-blue-900/50 transition-colors"
                                      title="Erneut starten"
                                    >
                                      🔄
                                    </button>
                                  )}

                                  {/* Delete — completed/failed/cancelled */}
                                  {canDelete && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(del.id) }}
                                      className="text-xs text-gray-600 hover:text-red-400 px-2 py-1 rounded hover:bg-red-900/20 transition-colors"
                                      title="Löschen"
                                    >
                                      🗑
                                    </button>
                                  )}

                                  {/* Open drawer — stopPropagation then open */}
                                  <button
                                    onClick={e => { e.stopPropagation(); setSelectedDelegation(del) }}
                                    className="text-xs text-gray-600 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                    title="Details öffnen"
                                  >
                                    →
                                  </button>

                                  {/* Permalink */}
                                  <Link
                                    href={`/delegations/${del.id}`}
                                    onClick={e => e.stopPropagation()}
                                    className="text-xs text-gray-700 hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-950/30 transition-colors"
                                    title="Permalink öffnen"
                                  >
                                    ⊞
                                  </Link>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {sortedDelegations.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="text-sm">Keine Delegationen für diesen Filter</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Delegation Drawer ──────────────────────────────────────────── */}
      {selectedDelegation && (
        <DelegationDrawer
          delegation={selectedDelegation}
          onClose={() => setSelectedDelegation(null)}
          onUpdate={applyUpdate}
          onDelete={applyDelete}
        />
      )}

      {/* ── New Delegation Dialog ─────────────────────────────────────── */}
      {showNewDialog && (
        <NewDelegationDialog
          onClose={() => setShowNewDialog(false)}
          onCreate={newDel => {
            applyAdd(newDel)
            setShowNewDialog(false)
          }}
        />
      )}
    </main>
  )
}

export default function DelegationsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-14 bg-gray-900 rounded-xl border border-gray-800 animate-pulse" />
          ))}
        </div>
      </main>
    }>
      <DelegationsContent />
    </Suspense>
  )
}
