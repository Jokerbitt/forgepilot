'use client'

import { useState, useEffect } from 'react'
import type { RiskClass } from '@/lib/models/work-item'

interface ManualTicketModalProps {
  isOpen: boolean
  onClose: () => void
  availableProjects: string[]
  availableMilestones: string[]
  onConfigUpdate: (key: 'projects' | 'milestones', value: string) => Promise<void>
}

export function ManualTicketModal({ isOpen, onClose, availableProjects, availableMilestones, onConfigUpdate }: ManualTicketModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(availableProjects[0] || 'LOCAL_IDEAS')
  const [milestone, setMilestone] = useState(availableMilestones[0] || 'Backlog')
  const [priority, setPriority] = useState<number>(2)
  const [riskClass, setRiskClass] = useState<RiskClass>('C')
  const [estimate, setEstimate] = useState<number>(60)
  const [saving, setSaving] = useState(false)
  
  const [isNewProjectMode, setIsNewProjectMode] = useState(false)
  const [isNewMilestoneMode, setIsNewMilestoneMode] = useState(false)
  const [newProject, setNewProject] = useState('')
  const [newMilestone, setNewMilestone] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (!availableProjects.includes(projectId) && availableProjects.length > 0) setProjectId(availableProjects[0])
      if (!availableMilestones.includes(milestone) && availableMilestones.length > 0) setMilestone(availableMilestones[0])
    }
  }, [isOpen, availableProjects, availableMilestones])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!title.trim() || saving) return
    setSaving(true)

    try {
      let finalProjectId = projectId
      let finalMilestone = milestone

      if (isNewProjectMode && newProject.trim()) {
        await onConfigUpdate('projects', newProject.trim())
        finalProjectId = newProject.trim()
      }

      if (isNewMilestoneMode && newMilestone.trim()) {
        await onConfigUpdate('milestones', newMilestone.trim())
        finalMilestone = newMilestone.trim()
      }

      await fetch('/api/magic-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          title,
          description,
          projectId: finalProjectId,
          milestone: finalMilestone,
          riskClass,
          priority,
          estimate
        })
      })
      onClose()
      window.location.reload()
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-950 border border-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <header className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📋</span> Ticket manuell anlegen
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            ✕
          </button>
        </header>

        <div className="p-6 overflow-y-auto space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Titel <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              placeholder="Kurze, prägnante Zusammenfassung"
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Beschreibung / User Story</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Als User möchte ich..."
              rows={4}
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Projekt</label>
              <div className="flex items-center gap-2">
                {isNewProjectMode ? (
                  <input 
                    type="text" 
                    autoFocus
                    value={newProject} 
                    onChange={e => setNewProject(e.target.value)}
                    placeholder="Neues Projekt..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
                  />
                ) : (
                  <select 
                    value={projectId} 
                    onChange={e => setProjectId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
                  >
                    {availableProjects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
                <button 
                  type="button"
                  onClick={() => setIsNewProjectMode(!isNewProjectMode)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2 rounded-md border border-gray-700 transition-colors"
                  title={isNewProjectMode ? "Abbrechen" : "Neues Projekt anlegen"}
                >
                  {isNewProjectMode ? "✕" : "➕ Neu"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Meilenstein</label>
              <div className="flex items-center gap-2">
                {isNewMilestoneMode ? (
                  <input 
                    type="text" 
                    autoFocus
                    value={newMilestone} 
                    onChange={e => setNewMilestone(e.target.value)}
                    placeholder="Neuer Meilenstein..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
                  />
                ) : (
                  <select 
                    value={milestone} 
                    onChange={e => setMilestone(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
                  >
                    {availableMilestones.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
                <button 
                  type="button"
                  onClick={() => setIsNewMilestoneMode(!isNewMilestoneMode)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2 rounded-md border border-gray-700 transition-colors"
                  title={isNewMilestoneMode ? "Abbrechen" : "Neuen Meilenstein anlegen"}
                >
                  {isNewMilestoneMode ? "✕" : "➕ Neu"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-gray-800 pt-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Priorität</label>
              <select 
                value={priority} 
                onChange={e => setPriority(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
              >
                <option value={0}>Urgent (0)</option>
                <option value={1}>High (1)</option>
                <option value={2}>Medium (2)</option>
                <option value={3}>Low (3)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Risikoklasse</label>
              <select 
                value={riskClass} 
                onChange={e => setRiskClass(e.target.value as RiskClass)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
              >
                <option value="A">Class A (Kritisch)</option>
                <option value="B">Class B (Moderat)</option>
                <option value="C">Class C (Gering)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Aufwand (Min.)</label>
              <input 
                type="number" 
                value={estimate} 
                onChange={e => setEstimate(Number(e.target.value))}
                step="15"
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Abbrechen
          </button>
          <button 
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-bold transition-colors shadow-lg shadow-blue-500/20"
          >
            {saving ? 'Speichert...' : 'Ticket erstellen'}
          </button>
        </footer>
      </div>
    </div>
  )
}
