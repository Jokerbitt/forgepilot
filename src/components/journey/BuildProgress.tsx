'use client'

import { useEffect, useState } from 'react'

interface ProgressView {
  state: 'waiting' | 'running' | 'retrying' | 'paused' | 'done' | 'failed' | 'cancelled'
  emoji: string
  headline: string
  detail?: string
}
interface PlanProgressView extends ProgressView {
  done: number
  total: number
  steps: ProgressView[]
}

const ACTIVE_STATES = new Set(['waiting', 'running', 'retrying', 'paused'])

/**
 * Journey Companion — plain-German live build progress. Polls
 * /api/journey/progress while the build is active. Drop it under a build result
 * and pass the returned delegationIds.
 */
export function BuildProgress({ delegationIds }: { delegationIds: string[] }) {
  const [progress, setProgress] = useState<PlanProgressView | null>(null)

  useEffect(() => {
    if (delegationIds.length === 0) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      try {
        const res = await fetch('/api/journey/progress', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delegationIds }),
        })
        if (res.ok && active) {
          const data = await res.json() as PlanProgressView
          setProgress(data)
          if (ACTIVE_STATES.has(data.state)) timer = setTimeout(poll, 4000)
        }
      } catch {
        if (active) timer = setTimeout(poll, 8000)
      }
    }
    poll()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [delegationIds])

  if (!progress) return null

  const barColor = progress.state === 'failed' ? 'bg-amber-500'
    : progress.state === 'done' ? 'bg-emerald-500'
    : progress.state === 'paused' ? 'bg-slate-400' : 'bg-indigo-500'
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-sm font-semibold text-slate-100">{progress.emoji} {progress.headline}</p>
      {progress.total > 0 && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.max(pct, progress.state === 'done' ? 100 : 4)}%` }} />
        </div>
      )}
      <ul className="mt-3 space-y-1">
        {progress.steps.map((s, i) => (
          <li key={i} className="text-xs text-slate-400">
            <span className="mr-1">{s.emoji}</span>
            <span className={s.state === 'failed' ? 'text-amber-300' : s.state === 'done' ? 'text-emerald-400' : 'text-slate-300'}>{s.headline}</span>
            {s.detail && <span className="text-slate-500"> — {s.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
