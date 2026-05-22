import { describe, expect, it, vi } from 'vitest'
import { reapStaleDelegations } from './watchdog'
import type { Delegation } from '@/lib/models/delegation'
import type { DelegationRepository } from '@/lib/repositories/delegationRepository'

const NOW = new Date('2026-05-22T10:00:00.000Z')

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'delegation-1',
    title: 'Running task',
    status: 'running',
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    contract: {
      id: 'contract-1',
      workItemId: 'work-1',
      goal: 'Run task',
      context: '',
      definitionOfDone: [],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: NOW.toISOString(),
    },
    logs: [],
    createdAt: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
    updatedAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
    ...overrides,
  }
}

function makeRepo(delegations: Delegation[]): DelegationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    listByProject: vi.fn(),
    listByStatus: vi.fn(async () => delegations),
    update: vi.fn(async (id: string, patch: Partial<Delegation>) => {
      const current = delegations.find(d => d.id === id)
      if (!current) return null
      Object.assign(current, patch, { updatedAt: NOW.toISOString() })
      return current
    }),
  } as unknown as DelegationRepository
}

describe('reapStaleDelegations', () => {
  it('marks stale running delegations failed when no process is alive', async () => {
    const delegation = makeDelegation()
    const repo = makeRepo([delegation])

    const reaped = await reapStaleDelegations(repo, {
      now: NOW,
      runningSilentMinutes: 10,
      processAlive: () => false,
    })

    expect(reaped).toEqual([
      { delegationId: 'delegation-1', title: 'Running task', silentMinutes: 20 },
    ])
    expect(delegation.status).toBe('failed')
    expect(delegation.errorMessage).toContain('Watchdog marked delegation stale')
    expect(delegation.logs?.at(-1)?.type).toBe('error')
  })

  it('does not mark a running delegation stale while its process is alive', async () => {
    const delegation = makeDelegation()
    const repo = makeRepo([delegation])

    const reaped = await reapStaleDelegations(repo, {
      now: NOW,
      runningSilentMinutes: 10,
      processAlive: () => true,
    })

    expect(reaped).toEqual([])
    expect(delegation.status).toBe('running')
  })

  it('does not mark a recently updated running delegation stale', async () => {
    const delegation = makeDelegation({
      updatedAt: new Date(NOW.getTime() - 2 * 60_000).toISOString(),
    })
    const repo = makeRepo([delegation])

    const reaped = await reapStaleDelegations(repo, {
      now: NOW,
      runningSilentMinutes: 10,
      processAlive: () => false,
    })

    expect(reaped).toEqual([])
    expect(delegation.status).toBe('running')
  })
})
