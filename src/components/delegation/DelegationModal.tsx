'use client'

import { useState } from 'react'
import type { NBARecommendation } from '@/lib/models/nba'
import type { Delegation, ExecutionRoute, PrivacyMode } from '@/lib/models/delegation'

interface DelegationModalProps {
  rec: NBARecommendation | null
  isOpen: boolean
  onClose: () => void
}

export function DelegationModal({ rec, isOpen, onClose }: DelegationModalProps) {
  const [isExpertMode, setIsExpertMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Expert mode states
  const [maxBudgetUsd, setMaxBudgetUsd] = useState(1.0)
  const [branchStrategy, setBranchStrategy] = useState<'feature' | 'fix' | 'chore'>('feature')
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('local')
  const [executionRoute, setExecutionRoute] = useState<ExecutionRoute>('local-agent')
  
  if (!isOpen || !rec) return null

  const handleDelegate = async () => {
    setIsSubmitting(true)
    
    // Create the delegation object
    const delegationId = `del-${Date.now()}`
    const delegation: Delegation = {
      id: delegationId,
      contract: {
        id: `tc-${Date.now()}`,
        workItemId: rec.workItem.id,
        goal: `Erledige Aufgabe: ${rec.workItem.title}`,
        context: '',
        definitionOfDone: ['Code kompiliert', 'Tests grün', 'Keine Linter-Fehler'],
        riskClass: rec.riskClass,
        maxBudgetUsd: isExpertMode ? maxBudgetUsd : 1.0,
        allowedTools: ['all'],
        branchStrategy: isExpertMode ? branchStrategy : 'feature',
        requiresApproval: true,
        privacyMode: isExpertMode ? privacyMode : 'local',
        createdAt: new Date().toISOString()
      },
      status: 'pending', // Execution router will pick this up
      executionRoute: isExpertMode ? executionRoute : rec.executionRoute,
      costEstimateUsd: rec.estimatedCostUsd || 0.1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Wir tun so als ob der Execution Router es sofort aufnimmt
    delegation.status = 'running'
    
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delegation)
    })
    
    setIsSubmitting(false)
    onClose()
    
    // Force reload to show active agent
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <header className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🤖</span> Task Contract: KI-Delegation
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </header>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-xs text-gray-500 font-mono mb-1">{rec.workItem.id}</div>
            <h3 className="text-lg font-medium text-white">{rec.workItem.title}</h3>
            <p className="text-sm text-gray-400 mt-2">Risiko-Klasse: <span className="text-white">{rec.riskClass}</span></p>
          </div>

          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
            <span className="text-gray-300 font-medium">Modus</span>
            <label className="flex items-center cursor-pointer">
              <span className={`mr-3 text-sm ${!isExpertMode ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>Simple Mode</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={isExpertMode} onChange={() => setIsExpertMode(!isExpertMode)} />
                <div className={`block w-10 h-6 rounded-full transition-colors ${isExpertMode ? 'bg-indigo-600' : 'bg-gray-700'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isExpertMode ? 'transform translate-x-4' : ''}`}></div>
              </div>
              <span className={`ml-3 text-sm ${isExpertMode ? 'text-indigo-400 font-bold' : 'text-gray-500'}`}>Expert Mode</span>
            </label>
          </div>

          {!isExpertMode ? (
            <div className="space-y-4 text-gray-300">
              <p>Dieser Task wird an die KI übergeben mit den folgenden Standardwerten:</p>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-400">
                <li>Budget-Limit: <strong className="text-white">$1.00</strong></li>
                <li>Branching: <strong className="text-white">Automatisch</strong></li>
                <li>Privacy: <strong className="text-white">Lokal (sicher)</strong></li>
                <li>Tools: <strong className="text-white">Alle Standard-Tools erlaubt</strong></li>
              </ul>
              <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg mt-4 text-sm text-blue-200">
                ℹ️ Im Simple Mode füllt die Engine den Vertrag automatisch optimal aus. Du kannst die Details später im Review prüfen.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Maximales Budget (USD)</label>
                <input 
                  type="number" step="0.1" 
                  value={maxBudgetUsd} onChange={e => setMaxBudgetUsd(parseFloat(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Branch-Strategie</label>
                <select 
                  value={branchStrategy} onChange={e => setBranchStrategy(e.target.value as any)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="feature">Feature Branch (z.B. feature/JOK-1)</option>
                  <option value="fix">Bugfix Branch (z.B. fix/JOK-1)</option>
                  <option value="chore">Chore Branch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Privacy Mode</label>
                <select 
                  value={privacyMode} onChange={e => setPrivacyMode(e.target.value as any)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="local">Lokal (Local LLM / Runner)</option>
                  <option value="private-cloud">Private Cloud (API)</option>
                  <option value="public">Public (Unbeschränkt)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Bevorzugter Agent (Route)</label>
                <select 
                  value={executionRoute} onChange={e => setExecutionRoute(e.target.value as any)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="local-agent">Antigravity (Local Agent)</option>
                  <option value="direct-chat">Claude Code (CLI)</option>
                  <option value="runner">n8n Workflow Runner</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
          <button 
            onClick={handleDelegate}
            disabled={isSubmitting}
            className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${
              isExpertMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isSubmitting ? 'Delegiere...' : 'Vertrag unterschreiben & Starten'}
          </button>
        </footer>
      </div>
    </div>
  )
}
