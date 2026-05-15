'use client'

import { useState, useEffect } from 'react'
import type { Delegation, DelegationStatus, ExecutionRoute, PrivacyMode } from '@/lib/models/delegation'
import type { RiskClass } from '@/lib/models/work-item'

interface TaskDetailModalProps {
  delegation: Delegation | null
  isOpen: boolean
  onClose: () => void
}

export function TaskDetailModal({ delegation, isOpen, onClose }: TaskDetailModalProps) {
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState<DelegationStatus>('pending')
  const [executionRoute, setExecutionRoute] = useState<ExecutionRoute>('local-agent')
  const [llmModel, setLlmModel] = useState('')
  const [riskClass, setRiskClass] = useState<RiskClass>('C')
  const [definitionOfDone, setDefinitionOfDone] = useState('')
  const [maxBudgetUsd, setMaxBudgetUsd] = useState(1.0)
  const [branchStrategy, setBranchStrategy] = useState<'feature' | 'fix' | 'chore'>('feature')
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('local')
  const [allowedTools, setAllowedTools] = useState('')
  
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (delegation && isOpen) {
      setGoal(delegation.contract.goal)
      setStatus(delegation.status)
      setExecutionRoute(delegation.executionRoute)
      setLlmModel(delegation.contract.llmModel || '')
      setRiskClass(delegation.contract.riskClass)
      setDefinitionOfDone(delegation.contract.definitionOfDone.join('\n'))
      setMaxBudgetUsd(delegation.contract.maxBudgetUsd)
      setBranchStrategy(delegation.contract.branchStrategy)
      setPrivacyMode(delegation.contract.privacyMode)
      setAllowedTools(delegation.contract.allowedTools.join(', '))
    }
  }, [delegation, isOpen])

  if (!isOpen || !delegation) return null

  const handleSave = async () => {
    if (saving) return
    setSaving(true)

    const updatedDod = definitionOfDone.split('\n').map(s => s.trim()).filter(s => s.length > 0)
    const updatedTools = allowedTools.split(',').map(s => s.trim()).filter(s => s.length > 0)

    const updatedDelegation: Delegation = {
      ...delegation,
      status,
      executionRoute,
      contract: {
        ...delegation.contract,
        goal,
        llmModel: llmModel || undefined,
        riskClass,
        definitionOfDone: updatedDod,
        maxBudgetUsd,
        branchStrategy,
        privacyMode,
        allowedTools: updatedTools
      }
    }

    try {
      await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDelegation)
      })
      onClose()
      window.location.reload()
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-950 border border-gray-700 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <header className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📋</span> Task Details bearbeiten
            </h2>
            <div className="text-sm text-gray-500 font-mono mt-1">{delegation.contract.workItemId}</div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">✕</button>
        </header>
        
        <div className="p-6 overflow-y-auto space-y-6">
          
          <div>
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Goal / Task</label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
              <select 
                value={status} onChange={e => setStatus(e.target.value as DelegationStatus)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none capitalize"
              >
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Agent Route</label>
              <select 
                value={executionRoute} onChange={e => setExecutionRoute(e.target.value as ExecutionRoute)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="local-agent">Local Agent (Antigravity)</option>
                <option value="direct-chat">Direct Chat (Claude Code)</option>
                <option value="runner">Runner Workflow</option>
                <option value="n8n">n8n Automation</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">LLM Model</label>
              <input 
                type="text" 
                value={llmModel} onChange={e => setLlmModel(e.target.value)}
                placeholder="z.B. claude-3-7-sonnet"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Risk Class</label>
              <select 
                value={riskClass} onChange={e => setRiskClass(e.target.value as RiskClass)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="A">Class A (High Risk)</option>
                <option value="B">Class B (Medium Risk)</option>
                <option value="C">Class C (Low Risk)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Definition of Done (DoD) & Tasks</label>
            <p className="text-xs text-gray-500 mb-2">Jede Zeile entspricht einem Task/Akzeptanzkriterium.</p>
            <textarea
              value={definitionOfDone}
              onChange={e => setDefinitionOfDone(e.target.value)}
              placeholder="1. Code analysieren..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none h-32"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Execution Constraints</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Budget ($)</label>
                <input 
                  type="number" step="0.5" 
                  value={maxBudgetUsd} onChange={e => setMaxBudgetUsd(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Branch Strategy</label>
                <select 
                  value={branchStrategy} onChange={e => setBranchStrategy(e.target.value as any)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="feature">Feature Branch</option>
                  <option value="fix">Fix Branch</option>
                  <option value="chore">Chore Branch</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Privacy Mode</label>
                <select 
                  value={privacyMode} onChange={e => setPrivacyMode(e.target.value as PrivacyMode)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="local">Local Only</option>
                  <option value="private-cloud">Private Cloud</option>
                  <option value="public">Public APIs Allowed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Allowed Tools (kommagetrennt)</label>
                <input 
                  type="text" 
                  value={allowedTools} onChange={e => setAllowedTools(e.target.value)}
                  placeholder="read_file, write_file, ..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
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
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-bold transition-colors shadow-lg shadow-blue-500/20"
          >
            {saving ? 'Speichert...' : 'Änderungen speichern'}
          </button>
        </footer>

      </div>
    </div>
  )
}
