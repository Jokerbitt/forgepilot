'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Delegation } from '@/lib/models/delegation'
import { DelegationDrawer } from '@/components/delegation/DelegationDrawer'
import { ElapsedTimer, formatCompletedDuration } from '@/components/shared/ElapsedTimer'
import { NewDelegationDialog } from '@/components/delegation/NewDelegationDialog'
import { ApprovalBadge } from '@/components/shared/ApprovalBadge'

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

export default function DelegationsPage() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDelegation, setSelectedDelegation] = useState<Delegation | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('Alle')
  const [projectFilter, setProjectFilter] = useState<string>('Alle')

  // Drag & Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Inline delete confirm in table row
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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

  const handleRowDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await fetch(`/api/delegations?id=${id}`, { method: 'DELETE' })
    applyDelete(id)
    setConfirmDeleteId(null)
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

  // ── Filters ─────────────────────────────────────────────────────────────
  const uniqueProjects = Array.from(
    new Set(delegations.map(d => d.contract.workItemId.split('-')[0] || 'Unknown'))
  ).sort()

  const filteredDelegations = delegations.filter(d => {
    const matchStatus  = statusFilter === 'Alle' || d.status === statusFilter
    const matchProject = projectFilter === 'Alle' || d.contract.workItemId.startsWith(projectFilter)
    return matchStatus && matchProject
  })

  const runningCount = delegations.filter(d => d.status === 'running').length
  const pendingCount = delegations.filter(d => d.status === 'pending').length

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
              {delegations.length} Delegation{delegations.length !== 1 ? 'en' : ''} gesamt
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              ← Dashboard
            </a>
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <span>+</span> Neue Delegation
            </button>
          </div>
        </header>

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
                      <th className="p-3 font-medium">Ticket / Ziel</th>
                      <th className="p-3 font-medium hidden md:table-cell">Agent</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium hidden sm:table-cell">Zeit</th>
                      <th className="p-3 font-medium text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/70">
                    {filteredDelegations.map((del, index) => {
                      const isDone = del.status === 'completed' || del.status === 'failed' || del.status === 'cancelled'
                      const canCancel = del.status === 'pending' || del.status === 'approved'
                      const canDelete = isDone

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
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {new Date(del.updatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                </div>
                              </div>
                            ) : (
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

                                  {/* Stop running */}
                                  {del.status === 'running' && (
                                    <button
                                      onClick={e => handleStatusChange(del.id, 'failed', e)}
                                      className="text-xs bg-red-900/50 text-red-400 hover:text-red-300 hover:bg-red-900 px-2 py-1 rounded border border-red-900/50 transition-colors"
                                      title="Stoppen"
                                    >
                                      ⏹
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

              {filteredDelegations.length === 0 && (
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
