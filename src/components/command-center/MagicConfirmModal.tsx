'use client'

import { useState, useEffect } from 'react'

interface MagicConfirmModalProps {
  isOpen: boolean
  prompt: string
  availableProjects: string[]
  availableMilestones: string[]
  onConfirm: (projectId: string, milestone: string) => void
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

  useEffect(() => {
    if (isOpen) {
      if (!availableProjects.includes(projectId) && availableProjects.length > 0) setProjectId(availableProjects[0])
      if (!availableMilestones.includes(milestone) && availableMilestones.length > 0) setMilestone(availableMilestones[0])
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

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Erfasste Idee</label>
            <div className="p-3 bg-gray-900 border border-gray-800 rounded-md text-gray-200 text-sm">
              {prompt}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Projekt</label>
              <select 
                value={projectId} 
                onChange={e => setProjectId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
              >
                {availableProjects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Meilenstein</label>
              <select 
                value={milestone} 
                onChange={e => setMilestone(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
              >
                {availableMilestones.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex justify-end space-x-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Abbrechen
          </button>
          <button 
            onClick={() => onConfirm(projectId, milestone)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-colors shadow-lg shadow-blue-500/20"
          >
            Ticket generieren
          </button>
        </footer>
      </div>
    </div>
  )
}
