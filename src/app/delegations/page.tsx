'use client'

import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  Archive,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type { Delegation, TaskContract } from '@/lib/models/delegation'
import type { ProjectBrief } from '@/lib/models/project-brief'
import { formatAge, isCreatedToday } from '@/lib/utils/delegation-age'
import { DelegationDrawer } from '@/components/delegation/DelegationDrawer'
import { ElapsedTimer, formatCompletedDuration } from '@/components/shared/ElapsedTimer'
import { NewDelegationDialog } from '@/components/delegation/NewDelegationDialog'
import { QuickCreateDelegationModal } from '@/components/delegation/QuickCreateDelegationModal'
import { ApprovalBadge } from '@/components/shared/ApprovalBadge'
import { CriticScorePill } from '@/components/delegation/CriticScorePill'
import { AutopilotReadinessPill } from '@/components/delegation/AutopilotReadinessBadge'
import { VersionBadge } from '@/components/delegation/VersionBadge'
import { Badge, EmptyState, Metric, Panel, buttonClassName, cx } from '@/components/ui/primitives'
import { checkBudget, formatCostUsd } from '@/lib/delegations/cost-format'
import { SlaBadge } from '@/components/shared/SlaBadge'

type ApprovalFilter = 'Alle' | 'approval-required' | 'auto-approved' | 'risk-blocked'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-gray-800 text-gray-400 border-gray-600',
  approved:  'bg-blue-900/50 text-blue-400 border-blue-700',
  running:   'bg-violet-900/50 text-violet-300 border-violet-600',
  completed: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  failed:    'bg-red-900/50 text-red-400 border-red-700',
  cancelled: 'bg-gray-950 text-gray-600 border-gray-800',
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

function getTaskStatusStyle(status: string): { textClass: string; icon: string; iconClass: string } {
  switch (status) {
    case 'completed':  return { textClass: 'line-through text-gray-500', icon: '✓', iconClass: 'text-green-500' }
    case 'cancelled':  return { textClass: 'line-through text-gray-500', icon: '✕', iconClass: 'text-gray-400' }
    case 'failed':     return { textClass: 'line-through text-red-400',   icon: '✕', iconClass: 'text-red-500' }
    case 'in_progress': return { textClass: '', icon: '●', iconClass: 'text-yellow-400' }
    default:           return { textClass: 'text-gray-300', icon: '○', iconClass: 'text-gray-500' }
  }
}

const APPROVAL_FILTER_LABELS: Record<ApprovalFilter, string> = {
  Alle: 'Alle',
  'approval-required': 'Freigabe noetig',
  'auto-approved': 'Auto-freigegeben',
  'risk-blocked': 'RiskClass C',
}

const TASK_TYPE_LABELS: Record<string, string> = {
  feature: 'Feature',
  fix: 'Fix',
  chore: 'Chore',
  bugfix: 'Bugfix',
  docs: 'Docs',
  refactor: 'Refactor',
  research: 'Research',
}

function getWorkItemId(delegation: Delegation): string {
  return delegation.contract.workItemId || delegation.contract.id || delegation.id
}

function getProjectKey(delegation: Delegation): string {
  const workItemId = getWorkItemId(delegation)
  return workItemId.includes('-') ? workItemId.split('-')[0] : 'Local'
}

function getDelegationGoal(delegation: Delegation): string {
  return delegation.contract.goal || delegation.title || 'Unbenannte Delegation'
}

function DelegationsContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDelegation, setSelectedDelegation] = useState<Delegation | null>(null)
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  // ?new=1 or ?template=<id> auto-opens the full dialog on mount
  const [showNewDialog, setShowNewDialog] = useState(
    searchParams.get('new') === '1' || !!searchParams.get('template')
  )
  // Quick-create modal — direct path, bypasses NBA recommendation flow (JOK-76)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  // Template contract pre-fill — loaded when ?template=<id> is in URL
  const [templateContract, setTemplateContract] = useState<Partial<TaskContract> | undefined>(undefined)
  const [prefillBrief, setPrefillBrief] = useState<ProjectBrief | null>(null)

  // Load template contract once on mount if ?template=<id> present
  useEffect(() => {
    const templateId = searchParams.get('template')
    if (!templateId) return
    fetch(`/api/delegations/${templateId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: Delegation | null) => {
        if (d?.contract) setTemplateContract(d.contract)
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const briefId = searchParams.get('briefId')
    if (!briefId) return

    fetch(`/api/project-briefs/${briefId}`)
      .then(r => r.ok ? r.json() : null)
      .then((brief: ProjectBrief | null) => {
        if (!brief) return
        setPrefillBrief(brief)
        setTemplateContract({
          workItemId: `BRIEF-${brief.id.slice(0, 8)}`,
          goal: `Naechstes Arbeitspaket fuer "${brief.title}" umsetzen`,
          context: [
            `Projekt: ${brief.title}`,
            `Problem: ${brief.problemStatement}`,
            `Zielzustand: ${brief.desiredOutcome}`,
            brief.requirements?.length ? `Requirements: ${brief.requirements.map(req => req.title).join('; ')}` : '',
            brief.risks?.length ? `Risiken: ${brief.risks.map(risk => risk.title).join('; ')}` : '',
          ].filter(Boolean).join('\n'),
          definitionOfDone: [
            'Write Scope ist eingehalten',
            'Aenderung ist getestet oder nachvollziehbar verifiziert',
            'Ergebnis ist im Projektkontext dokumentiert',
          ],
          riskClass: 'B',
          maxBudgetUsd: 1,
          allowedTools: ['read_file', 'write_file', 'search_code'],
          branchStrategy: 'feature',
          requiresApproval: false,
          privacyMode: 'local',
        })
      })
      .catch(() => {})
  }, [searchParams])

  // Filters — initialised from URL params
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'Alle')
  const [projectFilter, setProjectFilter] = useState<string>(searchParams.get('project') ?? 'Alle')
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>((searchParams.get('approval') as ApprovalFilter) ?? 'Alle')
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') ?? '')
  const [todayOnly, setTodayOnly] = useState(searchParams.get('today') === '1')
  const [tagFilter, setTagFilter] = useState<string>(searchParams.get('tag') ?? 'Alle')
  const [showAllRows, setShowAllRows] = useState(false)
  const currentSearch = searchParams.toString()

  // Sync filters → URL (replace, no history entry)
  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'Alle')   params.set('status',   statusFilter)
    if (projectFilter !== 'Alle')  params.set('project',  projectFilter)
    if (approvalFilter !== 'Alle') params.set('approval', approvalFilter)
    if (searchQuery)               params.set('q',        searchQuery)
    if (todayOnly)                 params.set('today',    '1')
    if (tagFilter !== 'Alle')      params.set('tag',      tagFilter)
    const qs = params.toString()
    const nextUrl = qs ? `${pathname}?${qs}` : pathname
    if (currentSearch !== qs) {
      router.replace(nextUrl, { scroll: false })
    }
    setShowAllRows(false)
  }, [statusFilter, projectFilter, approvalFilter, searchQuery, todayOnly, tagFilter, pathname, router, currentSearch])

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
        if (showQuickCreate) { setShowQuickCreate(false); return }
        if (showNewDialog) { setShowNewDialog(false); return }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setShowQuickCreate(true)
      } else if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedDelegation, showNewDialog, showQuickCreate])

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

  const handleRetryDelegation = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const delegation = delegations.find(d => d.id === id)
    if (!delegation || (delegation.status !== 'failed' && delegation.status !== 'cancelled')) return

    setRetryingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/delegations/${id}/retry`, { method: 'POST' })
      if (!res.ok) {
        await loadDelegations()
        return
      }

      applyUpdate({
        ...delegation,
        status: 'pending',
        errorMessage: undefined,
        updatedAt: new Date().toISOString(),
      })
      await loadDelegations()
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
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

  // ── Checkbox selection (pending delegations only) ───────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const pendingDelegations = delegations.filter(d => d.status === 'pending')

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    const visiblePendingIds = sortedDelegations
      .filter(d => d.status === 'pending')
      .map(d => d.id)
    const allSelected = visiblePendingIds.every(id => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        visiblePendingIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        visiblePendingIds.forEach(id => next.add(id))
        return next
      })
    }
  }

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
      logs: [...(d.logs ?? []), { timestamp: now, type: 'success' as const, message: 'Batch-freigegeben.' }],
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

  const handleSelectionBatchApprove = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    // Optimistic update
    const now = new Date().toISOString()
    ids.forEach(id => {
      const del = delegations.find(d => d.id === id)
      if (!del || del.status !== 'pending' || del.contract.riskClass === 'C') return
      applyUpdate({
        ...del,
        status: 'approved',
        contract: { ...del.contract, requiresApproval: false },
        logs: [...(del.logs ?? []), { timestamp: now, type: 'success', message: 'Batch-freigegeben (Auswahl).' }],
        updatedAt: now,
      })
    })

    // Persist via batch-approve route
    await fetch('/api/delegations/batch-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    // Clear selection and refresh
    setSelectedIds(new Set())
    loadDelegations()
  }

  // ── Bulk Cancel (selected pending/approved/running) ──────────────────────
  const handleSelectionBatchCancel = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const now = new Date().toISOString()

    const cancellable = delegations.filter(
      d => selectedIds.has(d.id) && (d.status === 'pending' || d.status === 'approved' || d.status === 'running')
    )
    if (cancellable.length === 0) return

    // Optimistic update
    cancellable.forEach(del => {
      applyUpdate({
        ...del,
        status: 'cancelled',
        logs: [...(del.logs ?? []), { timestamp: now, type: 'info', message: 'Bulk-abgebrochen.' }],
        updatedAt: now,
      })
    })

    // Persist via individual cancel calls
    await Promise.all(
      cancellable.map(del =>
        fetch(`/api/delegations/${del.id}/cancel`, { method: 'POST' })
      )
    )

    setSelectedIds(new Set())
    loadDelegations()
  }

  // ── Bulk Archive (selected completed/failed/cancelled) ───────────────────
  const handleSelectionBatchArchive = async () => {
    if (selectedIds.size === 0) return
    const archivable = delegations.filter(
      d => selectedIds.has(d.id) && (d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled')
    )
    if (archivable.length === 0) return

    // Optimistic removal from list
    const archivableIds = new Set(archivable.map(d => d.id))
    setDelegations(prev => prev.filter(d => !archivableIds.has(d.id)))

    // Persist via individual delete calls
    await Promise.all(
      archivable.map(del =>
        fetch(`/api/delegations/${del.id}`, { method: 'DELETE' })
      )
    )

    setSelectedIds(new Set())
    loadDelegations()
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

  // ── Export Dropdown ─────────────────────────────────────────────────────────
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const exportDropdownRef = useRef<HTMLDivElement | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showExportDropdown) return
    const handler = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExportDropdown])

  // ── Filters ─────────────────────────────────────────────────────────────
  const uniqueProjects = Array.from(
    new Set(delegations.map(getProjectKey))
  ).sort()

  const uniqueTags = Array.from(
    new Set(delegations.flatMap(d => d.tags ?? []))
  ).sort()

  const filteredDelegations = delegations.filter(d => {
    const matchStatus  = statusFilter === 'Alle' || d.status === statusFilter
    const workItemId = getWorkItemId(d)
    const goal = getDelegationGoal(d)
    const matchProject = projectFilter === 'Alle' || getProjectKey(d) === projectFilter || workItemId.startsWith(projectFilter)
    const matchApproval =
      approvalFilter === 'Alle' ||
      (approvalFilter === 'approval-required' && d.contract.requiresApproval) ||
      (approvalFilter === 'auto-approved' && !d.contract.requiresApproval) ||
      (approvalFilter === 'risk-blocked' && d.contract.riskClass === 'C')
    const q = searchQuery.toLowerCase().trim()
    const matchSearch = !q ||
      (d.title || '').toLowerCase().includes(q) ||
      goal.toLowerCase().includes(q) ||
      workItemId.toLowerCase().includes(q) ||
      (d.contract.context || '').toLowerCase().includes(q) ||
      (d.briefTitle || '').toLowerCase().includes(q)
    const matchToday = !todayOnly || isCreatedToday(d.createdAt)
    const matchTag = tagFilter === 'Alle' || (d.tags ?? []).includes(tagFilter)

    return matchStatus && matchProject && matchApproval && matchSearch && matchToday && matchTag
  })

  const STATUS_SORT_WEIGHT: Record<string, number> = {
    running: 0, approved: 1, pending: 2, completed: 3, failed: 4, cancelled: 5,
  }

  const sortedDelegations = sortKey
    ? [...filteredDelegations].sort((a, b) => {
        let cmp = 0
        if (sortKey === 'goal') {
          cmp = getDelegationGoal(a).localeCompare(getDelegationGoal(b), 'de')
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
  const visibleDelegations = showAllRows ? sortedDelegations : sortedDelegations.slice(0, 50)
  const hiddenRowCount = Math.max(0, sortedDelegations.length - visibleDelegations.length)

  const runningCount = delegations.filter(d => d.status === 'running').length
  const pendingCount = delegations.filter(d => d.status === 'pending').length
  const failedCount = delegations.filter(d => d.status === 'failed').length
  const completedCount = delegations.filter(d => d.status === 'completed').length
  const approvalRequiredCount = delegations.filter(d => d.contract.requiresApproval).length
  const autoApprovedCount = delegations.filter(d => !d.contract.requiresApproval).length
  const riskBlockedCount = delegations.filter(d => d.contract.riskClass === 'C').length
  const recoveryCandidate = useMemo(() => {
    return delegations
      .filter(d => d.status === 'failed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null
  }, [delegations])

  // Cost stats
  const totalEstimated = delegations.reduce((sum, d) => sum + (d.costEstimateUsd || 0), 0)
  const totalActual = delegations
    .filter(d => d.actualCostUsd != null)
    .reduce((sum, d) => sum + (d.actualCostUsd ?? 0), 0)
  const hasActualCosts = delegations.some(d => d.actualCostUsd != null)

  // KPI: average completed duration in minutes
  const avgDurationMin = useMemo(() => {
    const completed = delegations.filter(d =>
      d.status === 'completed' && d.startedAt && d.completedAt
    )
    if (completed.length === 0) return null
    const total = completed.reduce((sum, d) => {
      const ms = new Date(d.completedAt!).getTime() - new Date(d.startedAt!).getTime()
      return sum + ms
    }, 0)
    return Math.round(total / completed.length / 60000)
  }, [delegations])

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
          <div className="flex flex-wrap items-center gap-2">
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
              <div className="relative" ref={exportDropdownRef}>
                <button
                  onClick={() => setShowExportDropdown(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 px-3 py-2 rounded-lg transition-colors"
                  title="Delegationen exportieren"
                >
                  <Download size={13} />
                  Export
                </button>
                {showExportDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        window.location.href = '/api/delegations/export?format=csv'
                        setShowExportDropdown(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <Download size={12} className="text-gray-500" />
                      Als CSV exportieren
                    </button>
                    <button
                      onClick={() => {
                        window.location.href = '/api/delegations/export?format=json'
                        setShowExportDropdown(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <Download size={12} className="text-gray-500" />
                      Als JSON exportieren
                    </button>
                  </div>
                )}
              </div>
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

        {/* ── Recovery Gate ───────────────────────────────────────────── */}
        {!loading && recoveryCandidate && (
          <Panel className="overflow-hidden border-rose-500/20 bg-rose-500/[0.06]">
            <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-300">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">Recovery Gate</Badge>
                    <span className="text-xs font-medium text-slate-500">
                      {failedCount} fehlerhafte Delegation{failedCount !== 1 ? 'en' : ''} blockieren neue Parallelstarts
                    </span>
                  </div>
                  <h2 className="mt-2 truncate text-sm font-semibold text-white">
                    {getDelegationGoal(recoveryCandidate)}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">
                    {recoveryCandidate.errorMessage ?? 'Kein Fehlertext gespeichert. Bitte Logs prüfen, bevor weitere Agenten starten.'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">{recoveryCandidate.id}</span>
                    <span>{recoveryCandidate.executionRoute}</span>
                    <span>
                      aktualisiert {new Date(recoveryCandidate.updatedAt).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedDelegation(recoveryCandidate)
                  }}
                  className={buttonClassName('secondary', 'min-h-9 text-xs')}
                >
                  Details prüfen
                </button>
                <button
                  onClick={e => handleRetryDelegation(recoveryCandidate.id, e)}
                  disabled={retryingIds.has(recoveryCandidate.id)}
                  className={buttonClassName('primary', 'min-h-9 text-xs')}
                >
                  <RefreshCw size={14} className={cx(retryingIds.has(recoveryCandidate.id) && 'animate-spin')} />
                  Retry einreihen
                </button>
              </div>
            </div>
          </Panel>
        )}

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
            <h3 className="text-lg text-gray-400 mb-2">Noch keine Delegations</h3>
            <p className="text-gray-600 text-sm mb-6">
              Noch keine Delegations — starte eine Idee unter{' '}
              <Link href="/idea" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">/idea</Link>{' '}
              oder erstelle direkt eine neue Delegation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/idea"
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                💡 Idee starten
              </Link>
              <button
                onClick={() => setShowNewDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                + Delegation erstellen
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── KPI Strip ───────────────────────────────────────────── */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: 'Gesamt',       value: delegations.length,    color: 'text-gray-200',    onClick: undefined },
                { label: 'Laufend',      value: runningCount,          color: 'text-violet-400',  onClick: () => setStatusFilter('running') },
                { label: 'Fertig',       value: completedCount,        color: 'text-emerald-400', onClick: () => setStatusFilter('completed') },
                { label: 'Fehler',       value: failedCount,           color: failedCount > 0 ? 'text-red-400' : 'text-gray-600', onClick: failedCount > 0 ? () => setStatusFilter('failed') : undefined },
                { label: 'Ø Dauer',      value: avgDurationMin != null ? `${avgDurationMin}m` : '–', color: 'text-blue-300', onClick: undefined },
                { label: 'Budget',       value: hasActualCosts ? `$${totalActual.toFixed(3)}` : `~$${totalEstimated.toFixed(2)}`, color: hasActualCosts ? 'text-yellow-400' : 'text-gray-500', onClick: undefined },
              ].map(({ label, value, color, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  disabled={!onClick}
                  className={`bg-gray-900 border border-gray-800 rounded-xl p-3 text-center transition-colors ${onClick ? 'hover:border-gray-600 cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{label}</div>
                </button>
              ))}
            </div>

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

              {/* Today filter toggle */}
              <div className="flex items-center gap-1.5 sm:pl-4 sm:border-l sm:border-gray-800">
                <button
                  onClick={() => setTodayOnly(v => !v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    todayOnly
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                  }`}
                  title="Nur Delegationen von heute anzeigen"
                >
                  📅 Heute
                </button>
              </div>

              {/* Search input */}
              <div className="flex w-full items-center gap-2 sm:w-auto sm:pl-4 sm:border-l sm:border-gray-800 sm:ml-auto">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Suchen… [/]"
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-full sm:w-44 transition-colors"
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

              {uniqueTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-4 border-l border-gray-800">
                  <span className="text-xs text-gray-500 mr-1 uppercase tracking-wide">Tag</span>
                  <button
                    onClick={() => setTagFilter('Alle')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      tagFilter === 'Alle'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                    }`}
                  >
                    Alle
                  </button>
                  {uniqueTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setTagFilter(tagFilter === tag ? 'Alle' : tag)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        tagFilter === tag
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

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

            {/* ── Filter result count ─────────────────────────────────── */}
            {sortedDelegations.length !== delegations.length && (
              <div className="flex items-center justify-between px-1 text-xs text-gray-500">
                <span>
                  <span className="text-white font-medium">{sortedDelegations.length}</span>
                  {' '}von {delegations.length} Delegationen
                </span>
                <button
                  onClick={() => {
                    setStatusFilter('Alle')
                    setProjectFilter('Alle')
                    setApprovalFilter('Alle')
                    setSearchQuery('')
                    setTodayOnly(false)
                    setTagFilter('Alle')
                  }}
                  className="text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Filter zurücksetzen ✕
                </button>
              </div>
            )}

            {/* ── Table ───────────────────────────────────────────────── */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-950 border-b border-gray-800 text-xs uppercase text-gray-500">
                      <th className="p-3 font-medium w-10 text-center">
                        {pendingDelegations.length > 0 && (() => {
                          const visiblePendingIds = sortedDelegations
                            .filter(d => d.status === 'pending')
                            .map(d => d.id)
                          const allChecked = visiblePendingIds.length > 0 && visiblePendingIds.every(id => selectedIds.has(id))
                          const someChecked = visiblePendingIds.some(id => selectedIds.has(id))
                          return (
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={el => {
                                if (el) el.indeterminate = someChecked && !allChecked
                              }}
                              onChange={toggleSelectAll}
                              className="cursor-pointer accent-green-500"
                              title="Alle pending auswählen"
                            />
                          )
                        })()}
                      </th>
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
                    {visibleDelegations.map((del, index) => {
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
                          {/* Priority / drag handle / checkbox — draggable only on this cell */}
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            {del.status === 'pending' ? (
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(del.id)}
                                  onChange={() => toggleSelect(del.id)}
                                  className="cursor-pointer accent-green-500"
                                  title="Auswählen (freigeben/abbrechen)"
                                />
                                <span
                                  draggable
                                  onDragStart={() => handleDragStart(index)}
                                  className="text-xs text-gray-600 cursor-grab group-hover:text-gray-400 transition-colors select-none px-1"
                                >
                                  ⋮⋮
                                </span>
                              </div>
                            ) : (del.status === 'approved' || del.status === 'running') ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(del.id)}
                                onChange={() => toggleSelect(del.id)}
                                className="cursor-pointer accent-red-500"
                                title="Auswählen (abbrechen)"
                              />
                            ) : (del.status === 'completed' || del.status === 'failed' || del.status === 'cancelled') ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(del.id)}
                                onChange={() => toggleSelect(del.id)}
                                className="cursor-pointer accent-gray-500"
                                title="Auswählen (archivieren)"
                              />
                            ) : !isDone ? (
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
                              <span className="text-xs text-gray-600 font-mono">{getWorkItemId(del)}</span>
                              {del.briefId && (
                                <Link
                                  href={`/project-briefs/${del.briefId}`}
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs px-1.5 py-0.5 rounded bg-indigo-950/50 border border-indigo-900/50 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/40 transition-colors truncate max-w-[140px]"
                                  title={del.briefTitle ?? 'Projektbrief'}
                                >
                                  ◇ {del.briefTitle ?? 'Brief'}
                                </Link>
                              )}
                              {del.contract.branchStrategy && TASK_TYPE_LABELS[del.contract.branchStrategy] && (
                                <Badge className="rounded-md" tone="neutral">
                                  {TASK_TYPE_LABELS[del.contract.branchStrategy]}
                                </Badge>
                              )}
                              <ApprovalBadge
                                requiresApproval={del.contract.requiresApproval}
                                riskClass={del.contract.riskClass}
                                compact
                              />
                              <VersionBadge delegationId={del.id} compact />
                            </div>
                            <div className="flex items-baseline gap-1.5">
                              <span className={`text-xs flex-shrink-0 ${getTaskStatusStyle(del.status).iconClass}`}>
                                {getTaskStatusStyle(del.status).icon}
                              </span>
                              <span className={`text-sm font-medium ${GOAL_STYLE[del.status] || 'text-gray-200'}`}>
                                {getDelegationGoal(del)}
                              </span>
                            </div>
                            {del.note?.text && (
                              <div className="text-xs text-yellow-400/70 mt-0.5 truncate max-w-xs">
                                📝 {del.note.text}
                              </div>
                            )}
                            {(del.tags ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(del.tags ?? []).map(tag => (
                                  <button
                                    key={tag}
                                    onClick={e => { e.stopPropagation(); setTagFilter(tag) }}
                                    className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                                      tagFilter === tag
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-purple-900/40 text-purple-300 hover:bg-purple-800/60'
                                    }`}
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Agent */}
                          <td className="p-3 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-gray-400">{del.executionRoute}</div>
                              <AutopilotReadinessPill contract={del.contract} />
                            </div>
                            {del.contract.llmModel && (
                              <div className="text-xs text-gray-600 mt-0.5">🧠 {del.contract.llmModel}</div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs rounded-md border font-medium uppercase tracking-wider whitespace-nowrap ${
                                STATUS_COLORS[del.status] || STATUS_COLORS.pending
                              } ${del.status === 'running' ? 'animate-pulse' : ''}`}>
                                {STATUS_LABELS[del.status] || del.status}
                              </span>
                              {del.criticScore?.verdict && (
                                <CriticScorePill
                                  verdict={del.criticScore.verdict}
                                  correctness={del.criticScore.correctness}
                                  efficiency={del.criticScore.efficiency}
                                  drift={del.criticScore.drift}
                                />
                              )}
                              {(del.retryCount ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 text-xs rounded bg-amber-900/40 border border-amber-700/50 text-amber-400 font-mono whitespace-nowrap">
                                  ↺ {del.retryCount}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Time */}
                          <td className="p-3 hidden sm:table-cell">
                            {del.status === 'running' ? (
                              <div>
                                <ElapsedTimer startedAt={del.updatedAt || del.createdAt} className="text-xs text-green-400 font-mono" />
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {new Date(del.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="mt-1">
                                  <SlaBadge delegation={del} />
                                </div>
                              </div>
                            ) : del.status === 'completed' && del.summaryReport ? (
                              <div>
                                <div className="text-xs text-green-400/70 font-mono">
                                  {formatCompletedDuration(del.createdAt, del.updatedAt)}
                                </div>
                                {del.actualCostUsd != null ? (() => {
                                  const budget = checkBudget(del.actualCostUsd, del.contract.maxBudgetUsd)
                                  return (
                                    <div className="mt-0.5" title={budget.message}>
                                      <span className={`text-xs font-mono ${budget.exceeded ? 'text-red-400' : budget.warning ? 'text-yellow-400' : 'text-yellow-600/80'}`}>
                                        {formatCostUsd(del.actualCostUsd)}
                                      </span>
                                      {budget.exceeded && <span className="ml-1 text-xs text-red-400">⚠</span>}
                                      {budget.warning && !budget.exceeded && <span className="ml-1 text-xs text-yellow-500">!</span>}
                                    </div>
                                  )
                                })() : (
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
                                  <div className="mt-1">
                                    <SlaBadge delegation={del} />
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
                                  {/* Approve — pending Class A/B: prominent button */}
                                  {canApprove && (
                                    <button
                                      onClick={e => handleApproveDelegation(del.id, e)}
                                      className="flex items-center gap-1 text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg border border-green-600 transition-colors font-semibold shadow-sm shadow-green-900/40"
                                      title="Delegation freigeben"
                                    >
                                      <Check size={12} />
                                      Genehmigen
                                    </button>
                                  )}

                                  {/* Start — approved: prominent "Ausführen" button */}
                                  {canStart && (
                                    <button
                                      onClick={e => handleStartDelegation(del.id, e)}
                                      className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg border border-blue-500 transition-colors font-semibold shadow-sm shadow-blue-900/40"
                                      title="Agent starten"
                                    >
                                      <Play size={12} />
                                      Ausführen
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
                                      onClick={e => handleRetryDelegation(del.id, e)}
                                      disabled={retryingIds.has(del.id)}
                                      className="text-xs bg-blue-900/50 text-blue-400 hover:bg-blue-900 px-2 py-1 rounded border border-blue-900/50 transition-colors"
                                      title="Erneut starten"
                                    >
                                      <RefreshCw size={13} className={cx(retryingIds.has(del.id) && 'animate-spin')} />
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

                                  {/* Clone — open new dialog pre-filled with this contract */}
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      setTemplateContract(del.contract)
                                      setShowNewDialog(true)
                                    }}
                                    className="text-xs text-gray-700 hover:text-purple-400 px-2 py-1 rounded hover:bg-purple-950/30 transition-colors"
                                    title="Klonen — neues Dialog vorausgefüllt mit diesem Contract"
                                  >
                                    🔁
                                  </button>

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
              {hiddenRowCount > 0 && (
                <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-800 px-4 py-4 text-sm text-gray-400 sm:flex-row">
                  <span>
                    Zeige 50 von {sortedDelegations.length} Delegationen. Nutze Filter oder Suche, um die Liste zu verdichten.
                  </span>
                  <button
                    onClick={() => setShowAllRows(true)}
                    className={buttonClassName('secondary', 'min-h-8 px-3 py-1.5 text-xs')}
                  >
                    Alle anzeigen
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Bulk Action Bar ───────────────────────────────────── */}
      {selectedIds.size > 0 && (() => {
        const selectedDels = delegations.filter(d => selectedIds.has(d.id))
        const canApprove = selectedDels.some(d => d.status === 'pending' && d.contract.riskClass !== 'C')
        const canCancel = selectedDels.some(d => d.status === 'pending' || d.status === 'approved' || d.status === 'running')
        const canArchive = selectedDels.some(d => d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled')
        return (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/95 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur">
            <span className="text-sm text-gray-300 mr-1">
              <span className="font-semibold text-white">{selectedIds.size}</span> ausgewählt
            </span>
            {canApprove && (
              <button
                onClick={() => void handleSelectionBatchApprove()}
                className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-600"
                title="Auswahl genehmigen (Risk Class C ausgeschlossen)"
              >
                ✓ Freigeben
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => void handleSelectionBatchCancel()}
                className="flex items-center gap-1.5 rounded-lg bg-red-900 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-800"
                title="Auswahl abbrechen (pending/approved/running)"
              >
                ✕ Abbrechen
              </button>
            )}
            {canArchive && (
              <button
                onClick={() => void handleSelectionBatchArchive()}
                className="flex items-center gap-1.5 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-600"
                title="Auswahl archivieren (completed/failed/cancelled löschen)"
              >
                🗑 Archivieren
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded px-2 py-1 text-sm text-gray-500 transition-colors hover:text-white ml-1"
              title="Auswahl aufheben"
            >
              ✕
            </button>
          </div>
        )
      })()}

      {/* ── Delegation Drawer ──────────────────────────────────────────── */}
      {selectedDelegation && (
        <DelegationDrawer
          delegation={selectedDelegation}
          onClose={() => setSelectedDelegation(null)}
          onUpdate={applyUpdate}
          onDelete={applyDelete}
        />
      )}

      {/* ── Quick Create Delegation Modal — direct path, bypasses NBA (JOK-76) */}
      {showQuickCreate && (
        <QuickCreateDelegationModal
          onClose={() => setShowQuickCreate(false)}
          onCreate={newDel => {
            applyAdd(newDel)
            setShowQuickCreate(false)
          }}
        />
      )}

      {/* ── New Delegation Dialog — full form with templates / expert options */}
      {showNewDialog && (
        <NewDelegationDialog
          onClose={() => { setShowNewDialog(false); setTemplateContract(undefined); setPrefillBrief(null) }}
          onCreate={newDel => {
            applyAdd(newDel)
            setShowNewDialog(false)
            setTemplateContract(undefined)
            setPrefillBrief(null)
          }}
          prefillContract={templateContract}
          prefillBriefId={prefillBrief?.id}
          prefillBriefTitle={prefillBrief?.title}
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
