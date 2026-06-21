'use client'

import { useEffect, useRef, useState } from 'react'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'

const TICK_INTERVAL_MS = 12000

/**
 * Silent background component: runs the Daily Assistant autonomy cycle when approvalMode === 'autopilot'.
 * Renders a small indicator badge when active; nothing when disabled.
 */
export function AutopilotRunner() {
  const [active, setActive] = useState(false)
  const [lastTriggered, setLastTriggered] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Load settings once to know if autopilot is on
    fetch('/api/settings')
      .then(r => r.json())
      .then((cfg: NBAConfig) => {
        setActive(cfg.approvalMode === 'autopilot')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!active) {
      if (tickRef.current) clearInterval(tickRef.current)
      return
    }

    const tick = async () => {
      try {
        const res = await fetch('/api/daily-assistant/autonomy-cycle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: false }),
        })
        if (res.ok) {
          const data = await res.json() as { started?: boolean }
          if (data.started) setLastTriggered(value => value + 1)
        }
      } catch {
        // silent
      }
    }

    tick()
    tickRef.current = setInterval(tick, TICK_INTERVAL_MS)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [active])

  if (!active) return null

  return (
    <div
      className="fixed bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-900 border border-green-900/50 text-xs text-green-400 shadow-lg"
      title="Autopilot aktiv — genehmigt automatisch und startet Class-A/B-Delegationen"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      Autopilot
      {lastTriggered > 0 && (
        <span className="text-green-300">+{lastTriggered}</span>
      )}
    </div>
  )
}
