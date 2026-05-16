'use client'

import { useEffect, useRef } from 'react'
import type { Delegation, AgentLog } from '@/lib/models/delegation'

interface DelegationLogsModalProps {
  delegation: Delegation | null
  isOpen: boolean
  onClose: () => void
}

export function DelegationLogsModal({ delegation, isOpen, onClose }: DelegationLogsModalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [delegation?.logs])

  if (!isOpen || !delegation) return null

  const getLogColor = (type: AgentLog['type']) => {
    switch (type) {
      case 'command': return 'text-yellow-400'
      case 'thought': return 'text-gray-500 italic'
      case 'success': return 'text-green-400 font-bold'
      case 'error': return 'text-red-500 font-bold'
      default: return 'text-gray-300'
    }
  }

  const getLogPrefix = (type: AgentLog['type']) => {
    switch (type) {
      case 'command': return '$ '
      case 'thought': return '# '
      case 'success': return '✓ '
      case 'error': return '✖ '
      default: return '> '
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-700 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        
        <header className="px-4 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <h2 className="text-sm font-mono text-gray-400 ml-2">
              agent-trace: {delegation.contract.workItemId} ({delegation.executionRoute})
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </header>
        
        <div 
          ref={terminalRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-sm space-y-2"
        >
          {(!delegation.logs || delegation.logs.length === 0) ? (
            <div className="text-gray-600 italic">Keine Logs vorhanden. Warte auf Agenten-Start...</div>
          ) : (
            delegation.logs.map((log, index) => (
              <div key={index} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded">
                <span className="text-gray-600 shrink-0 w-20">
                  {new Date(log.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`${getLogColor(log.type)} whitespace-pre-wrap break-words`}>
                  {getLogPrefix(log.type)}{log.message}
                </span>
              </div>
            ))
          )}
          
          {delegation.status === 'running' && (
            <div className="flex gap-4 px-2 py-0.5 mt-4">
              <span className="text-gray-600 shrink-0 w-20">--:--:--</span>
              <span className="text-green-500 animate-pulse">_</span>
            </div>
          )}
        </div>

        <footer className="px-4 py-2 border-t border-gray-800 bg-gray-900 flex justify-between items-center text-xs text-gray-500">
          <span>Status: <strong className="uppercase text-gray-300">{delegation.status}</strong></span>
          <span>Logs: {delegation.logs?.length || 0}</span>
        </footer>
      </div>
    </div>
  )
}
