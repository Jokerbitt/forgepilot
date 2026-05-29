import { describe, expect, it, vi } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import type { DelegationRepository } from '@/lib/repositories/delegationRepository'
import {
  buildRepairDelegationInput,
  ensureRepairDelegation,
} from './repair-delegation'

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  const now = '2026-05-29T08:00:00.000Z'
  return {
    id: overrides.id ?? 'original-1',
    title: overrides.title ?? 'Improve delivery flow',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.8,
    priority: 50,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    contract: {
      id: 'contract-1',
      workItemId: 'work-1',
      goal: 'Make delivery flow reliable',
      context: 'Original context',
      definitionOfDone: ['Tests pass'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: ['bash', 'read_file', 'write_file'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: now,
    },
    logs: [],
    qualityCheck: {
      criteria: [
        { item: 'Tests pass', met: false, confidence: 'high', notes: 'No test evidence found.' },
      ],
      overallScore: 72,
      verdict: 'partial',
      suggestion: 'Add focused test evidence.',
      checkedAt: now,
    },
    criticScore: {
      correctness: 60,
      efficiency: 80,
      drift: 65,
      verdict: 'needs-revision',
      summary: 'Good direction, but evidence is incomplete.',
      runAt: now,
    },
    ...overrides,
  }
}

function makeRepo(existing: Delegation[] = []): DelegationRepository & { create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(async input => ({
    ...input,
    id: 'repair-created',
    createdAt: '2026-05-29T08:01:00.000Z',
    updatedAt: '2026-05-29T08:01:00.000Z',
  }))
  return {
    create,
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listByStatus: vi.fn(async () => existing),
    listByProject: vi.fn(),
  } as unknown as DelegationRepository & { create: ReturnType<typeof vi.fn> }
}

describe('repair delegation', () => {
  it('builds a narrow approved repair slice for safe work', () => {
    const input = buildRepairDelegationInput(makeDelegation(), new Date('2026-05-29T08:01:00.000Z'))

    expect(input.title).toContain('Repair:')
    expect(input.status).toBe('approved')
    expect(input.contract.workItemId).toBe('repair:original-1')
    expect(input.contract.context).toContain('No test evidence found.')
    expect(input.contract.context).toContain('Good direction, but evidence is incomplete.')
    expect(input.contract.definitionOfDone.join('\n')).toContain('Delivery Gate')
    expect(input.chainedFromId).toBe('original-1')
  })

  it('keeps risk C repair slices pending for manual approval', () => {
    const original = makeDelegation({
      contract: { ...makeDelegation().contract, riskClass: 'C', requiresApproval: true },
    })
    const input = buildRepairDelegationInput(original)

    expect(input.status).toBe('pending')
    expect(input.contract.requiresApproval).toBe(true)
  })

  it('creates one repair delegation and avoids duplicates', async () => {
    const original = makeDelegation()
    const repo = makeRepo()

    const first = await ensureRepairDelegation(repo, original)
    expect(first.created).toBe(true)
    expect(repo.create).toHaveBeenCalledTimes(1)

    const existingRepair = makeDelegation({
      id: 'repair-existing',
      title: 'Repair: Improve delivery flow',
      status: 'approved',
      contract: {
        ...makeDelegation().contract,
        workItemId: 'repair:original-1',
        goal: 'Repair failed delivery gate',
      },
    })
    const repoWithExisting = makeRepo([original, existingRepair])
    const second = await ensureRepairDelegation(repoWithExisting, original)

    expect(second.created).toBe(false)
    expect(second.delegation.id).toBe('repair-existing')
    expect(repoWithExisting.create).not.toHaveBeenCalled()
  })
})
