'use client'

import { useState, useEffect } from 'react'

interface MagicConfirmModalProps {
  isOpen: boolean
  prompt: string
  availableProjects: string[]
  availableMilestones: string[]
  onConfirm: (projectId: string, milestone: string, existingTicketId?: string) => void
  onCancel: () => void
}

export function MagicConfirmModal({
  isOpen,
  prompt,
  availableProjects,
  availableMilestones,
  onConfirm,
  onCancel
}: MagicConfirmModalProps) {
  const [projectId, setProjectId] = useState(availableProjects[0] || 'LOCAL_IDEAS')
  const [milestone, setMilestone] = useState(availableMilestones[0] || 'Backlog')
  const [existingTickets, setExistingTickets] = useState<any[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string>('')
  const [loadingTickets, setLoadingTickets] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (!availableProjects.includes(projectId) && availableProjects.length > 0) setProjectId(availableProjects[0])
      if (!availableMilestones.includes(milestone) && availableMilestones.length > 0) setMilestone(availableMilestones[0])
      
      // Fetch local tickets
      setLoadingTickets(true)
      fetch('/api/work-items?source=local')
        .then(res => res.json())
        .then(data => {
          if (data && data.items) {
            setExistingTickets(data.items.filter((i: any) => i.source === 'local'))
          }
        })
        .catch(console.error)
        .finally(() => setLoadingTickets(false))
    } else {
      setSelectedTicketId('') // Reset when closed
    }
  }, [isOpen, availableProjects, availableMilestones])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-950 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        <header className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>✨</span> Magic Create Bestätigung
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
            ✕
          </button>
        </header>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Erfasste Idee</label>
            <div className="p-3 bg-gray-900 border border-gray-800 rounded-md text-gray-200 text-sm">
              {prompt}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-gray-800 pb-4">
              <label className="block text-sm font-medium text-blue-400 mb-2">Option A: Neues Ticket erstellen</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Projekt</label>
                  <select 
                    value={projectId} 
                    onChange={e => { setProjectId(e.target.value); setSelectedTicketId(''); }}
                    disabled={!!selectedTicketId}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white disabled:opacity-50"
                  >
                    {availableProjects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Meilenstein</label>
                  <select 
                    value={milestone} 
                    onChange={e => { setMilestone(e.target.value); setSelectedTicketId(''); }}
                    disabled={!!selectedTicketId}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white disabled:opacity-50"
                  >
                    {availableMilestones.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-400 mb-2">Option B: An bestehendes Ticket anhängen (als Task)</label>
              <select
                value={selectedTicketId}
                onChange={e => setSelectedTicketId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
              >
                <option value="">-- Kein bestehendes Ticket --</option>
                {existingTickets.map(ticket => (
                  <option key={ticket.id} value={ticket.id}>
                    {ticket.id}: {ticket.title.substring(0, 40)}{ticket.title.length > 40 ? '...' : ''}
                  </option>
                ))}
              </select>
              {loadingTickets && <p className="text-xs text-gray-500 mt-1">Lade Tickets...</p>}
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {selectedTicketId ? 'Erstellt eine ausführbare AI Delegation für das Ticket.' : 'Erstellt ein neues Ticket.'}
          </span>
          <div className="flex space-x-3">
            <button 
              onClick={onCancel}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Abbrechen
            </button>
            <button 
              onClick={() => onConfirm(projectId, milestone, selectedTicketId || undefined)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-colors shadow-lg shadow-blue-500/20"
            >
              {selectedTicketId ? 'Task anlegen' : 'Ticket generieren'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
