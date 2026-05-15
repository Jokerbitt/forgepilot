'use client'

import { useEffect, useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'

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
    
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...delegation, status: newStatus })
    })
    
    loadDelegations()
  }

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
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-950 border-b border-gray-800 text-xs uppercase text-gray-500">
                    <th className="p-4 font-medium">Ticket / Goal</th>
                    <th className="p-4 font-medium">Agent & LLM</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Startzeit</th>
                    <th className="p-4 font-medium">Kosten (Est.)</th>
                    <th className="p-4 font-medium text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {delegations.map(del => (
                    <tr key={del.id} className="hover:bg-gray-800/50 transition-colors group">
                      <td className="p-4">
                        <div className="text-xs text-gray-500 font-mono mb-1">{del.contract.workItemId}</div>
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
                      <td className="p-4 text-sm text-gray-400">
                        {new Date(del.createdAt).toLocaleString('de-DE', { 
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                        })}
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        ${del.costEstimateUsd?.toFixed(2) || '0.00'}
                      </td>
                      <td className="p-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {del.status === 'running' && (
                          <button 
                            onClick={() => handleStatusChange(del.id, 'failed')}
                            className="text-xs bg-red-900/50 text-red-400 hover:text-red-300 px-2 py-1 rounded"
                          >
                            Stop
                          </button>
                        )}
                        {(del.status === 'failed' || del.status === 'cancelled') && (
                          <button 
                            onClick={() => handleStatusChange(del.id, 'pending')}
                            className="text-xs bg-blue-900/50 text-blue-400 hover:text-blue-300 px-2 py-1 rounded"
                          >
                            Retry
                          </button>
                        )}
                        {del.status === 'running' && (
                          <button 
                            onClick={() => handleStatusChange(del.id, 'completed')}
                            className="text-xs bg-green-900/50 text-green-400 hover:text-green-300 px-2 py-1 rounded"
                          >
                            Force Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
