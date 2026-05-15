'use client'

import { useEffect, useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'

const AGENT_AVATARS: Record<string, { icon: string, name: string, color: string }> = {
  'local-agent': { icon: '🌌', name: 'Antigravity', color: 'bg-blue-900/50 text-blue-400 border-blue-500/30' },
  'direct-chat': { icon: '🟪', name: 'Claude Code', color: 'bg-purple-900/50 text-purple-400 border-purple-500/30' },
  'runner': { icon: '⚙️', name: 'n8n Runner', color: 'bg-green-900/50 text-green-400 border-green-500/30' }
}

export function ActiveAgentsPanel() {
  const [delegations, setDelegations] = useState<Delegation[]>([])

  useEffect(() => {
    fetch('/api/delegations')
      .then(res => res.json())
      .then(data => {
        // Only show running delegations
        setDelegations((data || []).filter((d: Delegation) => d.status === 'running'))
      })
  }, [])

  if (delegations.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 shadow-lg">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        Active Agent Runs ({delegations.length})
      </h3>
      
      <div className="flex gap-3 overflow-x-auto pb-2">
        {delegations.map(del => {
          const agent = AGENT_AVATARS[del.executionRoute] || AGENT_AVATARS['local-agent']
          
          return (
            <div 
              key={del.id}
              className={`flex-shrink-0 flex items-center gap-3 border rounded-lg p-3 min-w-[250px] relative group ${agent.color}`}
            >
              <div className="text-2xl animate-pulse">{agent.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{agent.name}</div>
                <div className="text-xs opacity-80 truncate">{del.contract.goal}</div>
                <div className="w-full bg-gray-800/50 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-current h-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }}></div>
                </div>
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-950 border border-gray-700 text-white text-xs p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                🤖 {agent.name} arbeitet daran. ETA: ~10 Minuten. Status: Running
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
