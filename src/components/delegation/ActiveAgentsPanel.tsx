'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Delegation } from '@/lib/models/delegation'

const AGENT_AVATARS: Record<string, { icon: string; name: string; color: string; border: string }> = {
  'local-agent': { icon: '🌌', name: 'Antigravity',  color: 'bg-blue-900/30   text-blue-400',   border: 'border-blue-500/30'   },
  'direct-chat': { icon: '🟪', name: 'Claude Code', color: 'bg-purple-900/30 text-purple-400', border: 'border-purple-500/30' },
  'runner':      { icon: '⚙️', name: 'n8n Runner',  color: 'bg-green-900/30  text-green-400',  border: 'border-green-500/30'  },
}

function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(startedAt).getTime()
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [startedAt])

  return <span className="font-mono">{elapsed}</span>
}

export function ActiveAgentsPanel() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [cancelling, setCancelling] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/delegations')
      const data = await res.json() as Delegation[]
      const running = (data || []).filter(d => d.status === 'running')
      setDelegations(prev => {
        const prevKey = prev.map(d => `${d.id}:${(d.logs ?? []).length}`).join(',')
        const nextKey = running.map((d: Delegation) => `${d.id}:${(d.logs ?? []).length}`).join(',')
        return prevKey === nextKey ? prev : running
      })
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 4000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleCancel = async (id: string) => {
    setCancelling(id)
    await fetch(`/api/delegations/${id}/cancel`, { method: 'POST' })
    setCancelling(null)
    await refresh()
  }

  if (delegations.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 shadow-lg">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        Aktive Agenten ({delegations.length})
      </h3>

      <div className="flex flex-col gap-2">
        {delegations.map(del => {
          const agent = AGENT_AVATARS[del.executionRoute] ?? AGENT_AVATARS['local-agent']
          const lastLog = del.logs && del.logs.length > 0 ? del.logs[del.logs.length - 1] : null
          const startLog = del.logs?.find(l => l.message.includes('gestartet'))
          const startedAt = startLog?.timestamp ?? del.updatedAt

          return (
            <div
              key={del.id}
              className={`flex items-center gap-3 border rounded-lg p-3 ${agent.color} ${agent.border}`}
            >
              <div className="text-2xl animate-pulse flex-shrink-0">{agent.icon}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold">{agent.name}</span>
                  <span className="text-xs opacity-60">·</span>
                  <span className="text-xs opacity-60">
                    <ElapsedTime startedAt={startedAt} />
                  </span>
                </div>
                <div className="text-xs opacity-80 truncate mb-1.5">{del.contract.goal}</div>
                {lastLog && (
                  <div className="text-xs opacity-60 truncate font-mono">
                    {lastLog.type === 'command' ? '› ' : ''}{lastLog.message.substring(0, 80)}
                  </div>
                )}
                {/* Animated progress bar */}
                <div className="w-full bg-gray-800/50 h-1 rounded-full mt-2 overflow-hidden">
                  <div className="bg-current h-full rounded-full animate-[shimmer_2s_ease-in-out_infinite] w-2/5" />
                </div>
              </div>

              {/* Cancel button */}
              <button
                onClick={() => handleCancel(del.id)}
                disabled={cancelling === del.id}
                className="flex-shrink-0 p-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Delegation abbrechen"
              >
                {cancelling === del.id ? '⏳' : '⛔'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
