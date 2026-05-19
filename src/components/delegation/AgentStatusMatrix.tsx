'use client'

import { Cpu, Cloud, Circle, Bot } from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import type { LiveAgentState } from '@/lib/models/live-agent'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentSlot {
  route: string
  label: string
  icon: React.ElementType
  maxParallel: number
  free: boolean
}

// ─── Static slot definitions ─────────────────────────────────────────────────

export const AGENT_SLOTS: AgentSlot[] = [
  { route: 'local-agent',  label: 'Claude Code',  icon: Cloud,   maxParallel: 2, free: false },
  { route: 'ollama-agent', label: 'Ollama',        icon: Cpu,     maxParallel: 3, free: true  },
  { route: 'simulation',   label: 'Simulation',    icon: Circle,  maxParallel: 4, free: true  },
  { route: 'runner',       label: 'Cloud',         icon: Bot,     maxParallel: 1, free: false },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Count how many LiveAgentState entries with status='running' belong to each route */
export function countRunningByRoute(
  states: LiveAgentState[],
  route: string,
): number {
  return states.filter(
    s => s.status === 'running' && (s.delegation.executionRoute ?? 'local-agent') === route,
  ).length
}

type TrafficLight = 'green' | 'yellow' | 'red'

export function trafficLight(running: number, max: number): TrafficLight {
  if (running === 0) return 'green'
  if (running < max) return 'yellow'
  return 'red'
}

const LIGHT_CLASSES: Record<TrafficLight, string> = {
  green:  'bg-emerald-400',
  yellow: 'bg-amber-400',
  red:    'bg-rose-400',
}

const LIGHT_TEXT: Record<TrafficLight, string> = {
  green:  'text-emerald-400',
  yellow: 'text-amber-400',
  red:    'text-rose-400',
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface AgentStatusMatrixProps {
  liveStates: LiveAgentState[]
}

export function AgentStatusMatrix({ liveStates }: AgentStatusMatrixProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {AGENT_SLOTS.map(slot => {
        const SlotIcon = slot.icon
        const running = countRunningByRoute(liveStates, slot.route)
        const light = trafficLight(running, slot.maxParallel)

        return (
          <div
            key={slot.route}
            className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2"
          >
            {/* Traffic-light indicator */}
            <span className={cx('relative flex h-2 w-2 shrink-0')}>
              {running > 0 && (
                <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', LIGHT_CLASSES[light])} />
              )}
              <span className={cx('relative inline-flex h-2 w-2 rounded-full', LIGHT_CLASSES[light])} />
            </span>

            {/* Icon + Label */}
            <SlotIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">{slot.label}</span>

            {/* Count / max */}
            <span className={cx('font-mono text-[11px] font-bold tabular-nums', running > 0 ? LIGHT_TEXT[light] : 'text-slate-600')}>
              {running}/{slot.maxParallel}
            </span>

            {slot.free && (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500">
                FREE
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
