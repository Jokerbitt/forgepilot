'use client'

import type { Delegation } from '@/lib/models/delegation'

interface TaskDetailModalProps {
  delegation: Delegation | null
  isOpen: boolean
  onClose: () => void
}

export function TaskDetailModal({ delegation, isOpen, onClose }: TaskDetailModalProps) {
  if (!isOpen || !delegation) return null
  
  const { contract } = delegation

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <header className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📋</span> Task Details
            </h2>
            <div className="text-sm text-gray-500 font-mono mt-1">{contract.workItemId}</div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </header>
        
        <div className="p-6 overflow-y-auto space-y-6">
          
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Goal</h3>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-gray-200">
              {contract.goal}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Status</h3>
              <div className="text-sm text-white font-medium capitalize">{delegation.status}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Risk Class</h3>
              <div className="text-sm text-white font-medium">{contract.riskClass}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Agent Route</h3>
              <div className="text-sm text-white font-medium">{delegation.executionRoute}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">LLM Model</h3>
              <div className="text-sm text-white font-medium">{contract.llmModel || 'Default'}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Definition of Done (DoD) & Acceptance</h3>
            <ul className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
              {contract.definitionOfDone.map((dod, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-blue-500 mt-0.5">☐</span>
                  <span>{dod}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Execution Constraints</h3>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 grid grid-cols-2 gap-y-2">
              <span className="text-gray-500">Max Budget:</span>
              <span className="text-right font-mono">${contract.maxBudgetUsd.toFixed(2)}</span>
              
              <span className="text-gray-500">Branch Strategy:</span>
              <span className="text-right font-mono">{contract.branchStrategy}</span>
              
              <span className="text-gray-500">Privacy Mode:</span>
              <span className="text-right font-mono">{contract.privacyMode}</span>
              
              <span className="text-gray-500">Allowed Tools:</span>
              <span className="text-right font-mono truncate">{contract.allowedTools.join(', ')}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
