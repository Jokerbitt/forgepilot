import { describe, expect, it } from 'vitest'
import type { AgentProfile } from '@/lib/models/agent-profile'
import type { Delegation } from '@/lib/models/delegation'
import type { ScopeClaim } from './scope-lock'
import { buildAgentControlPlaneSummary } from './control-plane'

const now = new Date().toISOString()

function agent(overrides: Partial<AgentProfile>): AgentProfile {
  return {
    id: 'backend-engineer',
    displayName: 'Backend Engineer',
    role: 'backend-engineer',
    availability: 'available',
    autonomyLevel: 'supervised-write',
    strengths: ['api-routes', 'tests'],
    limits: [],
    preferredWorkloads: ['coding'],
    allowedToolIds: ['Read', 'Edit'],
    skillRefs: [],
    costClass: 'included-subscription',
    updatedAt: now,
    ...overrides,
  }
}

function delegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: 'del-1',
    title: 'Build API route',
    contract: {
      id: 'contract-1',
      workItemId: 'work-1',
      goal: 'Build API route',
      context: 'Next.js endpoint',
      definitionOfDone: ['route works'],
      riskClass: 'A',
      maxBudgetUsd: 0,
      allowedTools: ['Read', 'Edit'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      skillCategory: 'api-route',
      allowedFilePatterns: ['src/app/api/demo/**'],
      createdAt: now,
    },
    status: 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    priority: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function claim(overrides: Partial<ScopeClaim>): ScopeClaim {
  return {
    agentId: 'backend-engineer',
    agentType: 'codex',
    milestone: 'M-test',
    branch: 'feature/test',
    filePatterns: ['src/lib/agents/**'],
    claimedAt: now,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  }
}

describe('buildAgentControlPlaneSummary', () => {
  it('recommends parallel slots and best fitting agents', () => {
    const summary = buildAgentControlPlaneSummary(
      [
        agent({ id: 'backend-engineer', role: 'backend-engineer', displayName: 'Backend Engineer' }),
        agent({
          id: 'frontend-saas-designer',
          role: 'frontend-saas-designer',
          displayName: 'Frontend Designer',
          strengths: ['ui-ux', 'react-components'],
        }),
      ],
      [],
      [delegation({})],
    )

    expect(summary.coordination.canStartMoreWork).toBe(true)
    expect(summary.coordination.recommendedParallelSlots).toBe(1)
    expect(summary.nextDelegations[0].suggestedAgentId).toBe('backend-engineer')
  })

  it('reduces free slots when active scope claims exist', () => {
    const base = delegation({})
    const summary = buildAgentControlPlaneSummary(
      [
        agent({ id: 'backend-engineer' }),
        agent({ id: 'qa-reviewer', role: 'qa-reviewer', displayName: 'QA Reviewer' }),
      ],
      [claim({ agentId: 'backend-engineer' })],
      [
        base,
        delegation({
          id: 'del-2',
          title: 'Add tests',
          contract: { ...base.contract, id: 'contract-2', skillCategory: 'test' },
        }),
      ],
    )

    expect(summary.scopes.active).toBe(1)
    expect(summary.coordination.recommendedParallelSlots).toBe(1)
  })

  it('blocks new work when failed delegations need review', () => {
    const summary = buildAgentControlPlaneSummary(
      [agent({ id: 'backend-engineer' })],
      [],
      [delegation({ status: 'failed', errorMessage: 'Tests failed' })],
    )

    expect(summary.coordination.canStartMoreWork).toBe(false)
    expect(summary.coordination.blockedReason).toContain('Fehlerhafte Delegationen')
  })
})
