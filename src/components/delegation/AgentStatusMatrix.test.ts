import { describe, it, expect } from 'vitest'
import type { LiveAgentState } from '@/lib/models/live-agent'
import type { Delegation } from '@/lib/models/delegation'
import {
  AGENT_SLOTS,
  countRunningByRoute,
  trafficLight,
} from './AgentStatusMatrix'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_DELEGATION: Delegation = {
  id: 'del-1',
  title: 'Test Delegation',
  status: 'running',
  executionRoute: 'local-agent',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  logs: [],
  costEstimateUsd: 0,
  contract: {
    id: 'c-1',
    workItemId: 'JOK-1',
    goal: 'Test goal',
    context: '',
    definitionOfDone: [],
    riskClass: 'B',
    maxBudgetUsd: 1,
    allowedTools: [],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: '2026-01-01T00:00:00Z',
  },
}

function makeLiveState(
  overrides: Partial<Delegation> = {},
): LiveAgentState {
  return {
    delegation: { ...BASE_DELEGATION, ...overrides },
    logs: [],
    status: overrides.status ?? 'running',
    streaming: false,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AGENT_SLOTS', () => {
  it('defines 4 slots with correct route keys', () => {
    const routes = AGENT_SLOTS.map(s => s.route)
    expect(routes).toContain('local-agent')
    expect(routes).toContain('ollama-agent')
    expect(routes).toContain('simulation')
    expect(routes).toContain('runner')
    expect(routes).toHaveLength(4)
  })

  it('has human-readable labels for every slot', () => {
    AGENT_SLOTS.forEach(slot => {
      expect(slot.label.length).toBeGreaterThan(0)
    })
  })
})

describe('countRunningByRoute', () => {
  it('counts only running states matching the given route', () => {
    const states: LiveAgentState[] = [
      makeLiveState({ id: 'a', status: 'running', executionRoute: 'local-agent' }),
      makeLiveState({ id: 'b', status: 'running', executionRoute: 'local-agent' }),
      makeLiveState({ id: 'c', status: 'completed', executionRoute: 'local-agent' }),
      makeLiveState({ id: 'd', status: 'running', executionRoute: 'ollama-agent' }),
    ]

    expect(countRunningByRoute(states, 'local-agent')).toBe(2)
    expect(countRunningByRoute(states, 'ollama-agent')).toBe(1)
    expect(countRunningByRoute(states, 'simulation')).toBe(0)
  })

  it('returns 0 when no states are provided (all-stopped state)', () => {
    expect(countRunningByRoute([], 'local-agent')).toBe(0)
    expect(countRunningByRoute([], 'ollama-agent')).toBe(0)
  })

  it('defaults missing executionRoute to local-agent', () => {
    const stateWithoutRoute = makeLiveState({ id: 'x', status: 'running' })
    // executionRoute is undefined — should fall back to 'local-agent'
    delete (stateWithoutRoute.delegation as Partial<Delegation>).executionRoute
    expect(countRunningByRoute([stateWithoutRoute], 'local-agent')).toBe(1)
    expect(countRunningByRoute([stateWithoutRoute], 'ollama-agent')).toBe(0)
  })
})

describe('trafficLight', () => {
  it('returns green when nothing is running', () => {
    expect(trafficLight(0, 4)).toBe('green')
  })

  it('returns yellow when some but not all slots are occupied', () => {
    expect(trafficLight(1, 3)).toBe('yellow')
    expect(trafficLight(2, 3)).toBe('yellow')
  })

  it('returns red when at capacity', () => {
    expect(trafficLight(3, 3)).toBe('red')
    expect(trafficLight(4, 4)).toBe('red')
  })
})
