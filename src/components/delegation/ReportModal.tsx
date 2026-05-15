'use client'

import type { Delegation } from '@/lib/models/delegation'

interface ReportModalProps {
  delegation: Delegation | null
  isOpen: boolean
  onClose: () => void
}

export function ReportModal({ delegation, isOpen, onClose }: ReportModalProps) {
  if (!isOpen || !delegation || !delegation.summaryReport) return null
  
  const { summaryReport } = delegation

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-700 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <header className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-blue-900/20">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <span>📝</span> End-of-Run Report
            </h2>
            <div className="text-sm text-gray-400 mt-1">Für Delegation {delegation.id}</div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </header>
        
        <div className="p-6 overflow-y-auto space-y-6">
          
          <div className="grid grid-cols-3 gap-4 border-b border-gray-800 pb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">{summaryReport.timeTakenMinutes}<span className="text-lg text-gray-500">m</span></div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Dauer</div>
            </div>
            <div className="text-center border-l border-r border-gray-800">
              <div className="text-3xl font-bold text-green-400 mb-1">{summaryReport.changes.length}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Geänderte Dateien</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1 font-mono">${delegation.actualCostUsd?.toFixed(2) || delegation.costEstimateUsd?.toFixed(2)}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">API Kosten</div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-3">Key Points & Erkenntnisse</h3>
            <ul className="space-y-3">
              {summaryReport.keyPoints.map((point, i) => (
                <li key={i} className="flex gap-3 text-gray-300">
                  <span className="text-blue-500 mt-1">💡</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-3">Geänderte Dateien</h3>
            <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
              {summaryReport.changes.map((change, i) => (
                <div key={i} className={`p-3 text-sm font-mono flex items-center gap-2 ${i !== summaryReport.changes.length - 1 ? 'border-b border-gray-800' : ''}`}>
                  <span className={change.includes('[NEW]') ? 'text-green-400' : change.includes('[DEL]') ? 'text-red-400' : 'text-blue-400'}>
                    {change.includes('[NEW]') ? '+ ' : change.includes('[DEL]') ? '- ' : '~ '}
                  </span>
                  <span className="text-gray-300">{change.replace(/\[NEW\]|\[DEL\]|\[MOD\]/g, '').trim()}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
        
        <footer className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white transition-colors"
          >
            Schließen
          </button>
        </footer>
      </div>
    </div>
  )
}
