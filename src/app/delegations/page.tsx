'use client'

import { useEffect, useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'
import { DelegationLogsModal } from '@/components/delegation/DelegationLogsModal'
import { TaskDetailModal } from '@/components/delegation/TaskDetailModal'
import { ReportModal } from '@/components/delegation/ReportModal'

const STATUS_COLORS: Record<string, string> = {
  'pending': 'bg-yellow-900/50 text-yellow-500 border-yellow-700',
  'approved': 'bg-blue-900/50 text-blue-500 border-blue-700',
  'running': 'bg-green-900/50 text-green-400 border-green-500',
  'completed': 'bg-gray-800 text-gray-300 border-gray-600',
  'failed': 'bg-red-900/50 text-red-400 border-red-700',
  'cancelled': 'bg-gray-900 text-gray-500 border-gray-800'
}

export default function DelegationsPage() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLogDelegation, setSelectedLogDelegation] = useState<Delegation | null>(null)
  const [selectedTaskDelegation, setSelectedTaskDelegation] = useState<Delegation | null>(null)
  const [selectedReportDelegation, setSelectedReportDelegation] = useState<Delegation | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('Alle')
  const [projectFilter, setProjectFilter] = useState<string>('Alle')

  // Drag & Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const loadDelegations = () => {
    fetch('/api/delegations')
      .then(res => res.json())
      .then(data => {
        // Sort by newest first
        const sorted = (data || []).sort((a: Delegation, b: Delegation) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setDelegations(sorted)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadDelegations()
  }, [])

  const handleStatusChange = async (id: string, newStatus: string) => {
    const delegation = delegations.find(d => d.id === id)
    if (!delegation) return
    
    const updateData = { ...delegation, status: newStatus }
    
    // Simulate a report when completed
    if (newStatus === 'completed' && !delegation.summaryReport) {
      updateData.summaryReport = {
        keyPoints: [
          'Code refactored to use standard models',
          'Unit tests pass 100%',
          'No linting errors found'
        ],
        changes: ['[MOD] src/app/page.tsx', '[NEW] src/components/NewFeature.tsx'],
        timeTakenMinutes: Math.floor(Math.random() * 20) + 1
      }
    }
    
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })
    
    loadDelegations()
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newDelegations = [...delegations]
    const draggedItem = newDelegations[draggedIndex]
    newDelegations.splice(draggedIndex, 1)
    newDelegations.splice(index, 0, draggedItem)

    setDelegations(newDelegations)
    setDraggedIndex(index)
  }

  const handleDrop = () => {
    setDraggedIndex(null)
    // In a real app, save the new priority order to backend
  }

  const uniqueProjects = Array.from(new Set(delegations.map(d => d.contract.workItemId.split('-')[0] || 'Unknown'))).sort()
  const filteredDelegations = delegations.filter(d => {
    const matchStatus = statusFilter === 'Alle' || d.status === statusFilter
    const matchProject = projectFilter === 'Alle' || d.contract.workItemId.startsWith(projectFilter)
    return matchStatus && matchProject
  })

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span>📋</span> Delegation Center
            </h1>
            <p className="text-gray-400 mt-1">Übersicht aller KI-Prozesse und Runner-Aufträge</p>
          </div>
          <a href="/" className="text-blue-500 hover:text-blue-400">Zurück zum Dashboard</a>
        </header>

        {loading ? (
          <div className="text-gray-500">Lade Prozesse...</div>
        ) : delegations.length === 0 ? (
          <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 text-center">
            <h3 className="text-xl text-gray-400 mb-2">Noch keine Delegationen</h3>
            <p className="text-gray-500">Starte Aufgaben auf dem Dashboard, indem du auf "AN KI DELEGIEREN" klickst.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-2 bg-gray-900 p-4 rounded-xl border border-gray-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500 mr-2">Status:</span>
                {['Alle', 'running', 'pending', 'completed', 'failed'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
              {uniqueProjects.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 md:ml-4 pl-4 md:border-l border-gray-800">
                  <span className="text-sm text-gray-500 mr-2">Projekt:</span>
                  <button
                    onClick={() => setProjectFilter('Alle')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      projectFilter === 'Alle' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                    }`}
                  >
                    ALLE
                  </button>
                  {uniqueProjects.map(p => (
                    <button
                      key={p}
                      onClick={() => setProjectFilter(p)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        projectFilter === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-950 border-b border-gray-800 text-xs uppercase text-gray-500">
                    <th className="p-4 font-medium w-16">Prio</th>
                    <th className="p-4 font-medium">Ticket / Goal</th>
                    <th className="p-4 font-medium">Agent & LLM</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">ETA</th>
                    <th className="p-4 font-medium text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredDelegations.map((del, index) => {
                    const estimatedEnd = del.status === 'running' 
                      ? new Date(new Date(del.createdAt).getTime() + (del.costEstimateUsd || 1) * 30 * 60000) 
                      : null;
                    
                    const isCompleted = del.status === 'completed' || del.status === 'failed';
                    
                    return (
                    <tr 
                      key={del.id} 
                      className={`hover:bg-gray-800/50 transition-colors group ${draggedIndex === index ? 'opacity-50 bg-gray-800' : ''}`}
                      draggable={!isCompleted}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDrop}
                    >
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          {!isCompleted && <span className="text-xs font-bold text-gray-500 cursor-grab active:cursor-grabbing">#{index + 1}</span>}
                          {isCompleted && <span className="text-xs text-gray-600">-</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => setSelectedTaskDelegation(del)}
                          className="text-xs text-blue-400 hover:underline font-mono mb-1 cursor-pointer flex items-center gap-1"
                          title="View Task Details"
                        >
                          {del.contract.workItemId} ℹ️
                        </button>
                        <div className="font-medium text-sm text-gray-200">{del.contract.goal}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-300">{del.executionRoute}</div>
                        {del.contract.llmModel && (
                          <div className="text-xs text-gray-500 mt-0.5">🧠 {del.contract.llmModel}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs rounded-md border font-medium uppercase tracking-wider ${STATUS_COLORS[del.status] || STATUS_COLORS['pending']}`}>
                          {del.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-400">
                          {new Date(del.createdAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {estimatedEnd && (
                          <div className="text-xs text-blue-400 mt-1 font-mono">
                            ETA: {estimatedEnd.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {isCompleted && del.updatedAt && (
                          <div className="text-xs text-green-500/70 mt-1 font-mono">
                            Done: {new Date(del.updatedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right flex justify-end items-center gap-2">
                        {del.status === 'completed' && del.summaryReport && (
                          <button 
                            onClick={() => setSelectedReportDelegation(del)}
                            className="text-xs bg-blue-900/50 text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-900/50"
                          >
                            📝 Report
                          </button>
                        )}
                        <button 
                          onClick={() => setSelectedLogDelegation(del)}
                          className="text-xs bg-gray-800 text-gray-300 hover:text-white px-2 py-1 rounded border border-gray-700"
                        >
                          🔍 Logs
                        </button>
                        {del.status === 'running' && (
                          <button 
                            onClick={() => handleStatusChange(del.id, 'failed')}
                            className="text-xs bg-red-900/50 text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-900/50"
                          >
                            Stop
                          </button>
                        )}
                        {(del.status === 'failed' || del.status === 'cancelled') && (
                          <button 
                            onClick={() => handleStatusChange(del.id, 'pending')}
                            className="text-xs bg-blue-900/50 text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-900/50"
                          >
                            Retry
                          </button>
                        )}
                        {del.status === 'running' && (
                          <button 
                            onClick={() => handleStatusChange(del.id, 'completed')}
                            className="text-xs bg-green-900/50 text-green-400 hover:text-green-300 px-2 py-1 rounded border border-green-900/50"
                          >
                            Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}
      </div>

      <DelegationLogsModal 
        delegation={selectedLogDelegation}
        isOpen={!!selectedLogDelegation}
        onClose={() => setSelectedLogDelegation(null)}
      />

      <TaskDetailModal 
        delegation={selectedTaskDelegation}
        isOpen={!!selectedTaskDelegation}
        onClose={() => setSelectedTaskDelegation(null)}
      />

      <ReportModal 
        delegation={selectedReportDelegation}
        isOpen={!!selectedReportDelegation}
        onClose={() => setSelectedReportDelegation(null)}
      />
    </main>
  )
}
