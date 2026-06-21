import { describe, expect, it } from 'vitest'
import { buildAgentWorkbenchSummary } from './summary'
import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'
import type { AgentProfile } from '@/lib/models/agent-profile'
import type { Delegation } from '@/lib/models/delegation'

const now = new Date('2026-05-28T10:00:00.000Z')

function agent(overrides: Partial<AgentProfile>): AgentProfile {
  return {
    id: 'agent-1',
    displayName: 'Agent 1',
    role: 'backend-engineer',
    availability: 'available',
    autonomyLevel: 'supervised-write',
    strengths: [],
    limits: [],
    preferredWorkloads: [],
    allowedToolIds: [],
    skillRefs: [],
    costClass: 'included-subscription',
    updatedAt: now.toISOString(),
    ...overrides,
  }
}

function delegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: 'delegation-1',
    title: 'Build feature',
    status: 'approved',
    executionRoute: 'runner',
    costEstimateUsd: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    contract: {
      id: 'contract-1',
      workItemId: 'work-1',
      goal: 'Build feature',
      context: '',
      definitionOfDone: ['Done'],
      riskClass: 'B',
      maxBudgetUsd: 0,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: true,
      privacyMode: 'local',
      createdAt: now.toISOString(),
    },
    ...overrides,
  }
}

function run(overrides: Partial<OrchestratedRun>): OrchestratedRun {
  return {
    id: 'run-1',
    delegationId: 'delegation-1',
    delegationTitle: 'Build feature',
    goal: 'Build feature',
    status: 'running',
    tasks: [],
    currentTaskIndex: 0,
    maxRetries: 2,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  }
}

describe('buildAgentWorkbenchSummary', () => {
  it('summarizes agent cost modes and collaboration lanes', () => {
    const summary = buildAgentWorkbenchSummary({
      now,
      agents: [
        agent({ id: 'planner', role: 'product-planner', costClass: 'metered-high', autonomyLevel: 'propose-only' }),
        agent({ id: 'builder', role: 'backend-engineer', costClass: 'included-subscription' }),
        agent({ id: 'critic', role: 'critic-reviewer', costClass: 'free-local', autonomyLevel: 'propose-only' }),
      ],
      delegations: [delegation({ status: 'approved' })],
      runs: [],
    })

    expect(summary.agents.total).toBe(3)
    expect(summary.agents.local).toBe(1)
    expect(summary.agents.includedSubscription).toBe(1)
    expect(summary.agents.metered).toBe(1)
    expect(summary.lanes.find(lane => lane.key === 'build')?.agentCount).toBe(1)
    expect(summary.lanes.find(lane => lane.key === 'review')?.availableCount).toBe(1)
    expect(summary.recommendation.title).toBe('Naechste Delegation starten')
  })

  it('prioritizes failed delegations over starting more work', () => {
    const summary = buildAgentWorkbenchSummary({
      now,
      agents: [agent({ id: 'builder' })],
      delegations: [
        delegation({ id: 'approved', status: 'approved' }),
        delegation({ id: 'failed', status: 'failed' }),
      ],
      runs: [],
    })

    expect(summary.recommendation.tone).toBe('blocked')
    expect(summary.recommendation.href).toBe('/delegations?status=failed')
  })

  it('surfaces active orchestrated runs as work in progress', () => {
    const summary = buildAgentWorkbenchSummary({
      now,
      agents: [agent({ id: 'builder' })],
      delegations: [],
      runs: [run({ status: 'running' })],
    })

    expect(summary.work.activeRuns).toBe(1)
    expect(summary.work.recentRuns).toBe(1)
    expect(summary.recommendation.title).toBe('Laufende Agenten beobachten')
  })
})
