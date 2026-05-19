import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import * as cv from './contract-versions'
import type { TaskContract, Delegation } from '../models/delegation'

// Mock fs module
vi.mock('fs/promises')

const mockContract: TaskContract = {
  id: 'contract-1',
  workItemId: 'item-1',
  goal: 'Implement feature X',
  context: 'This is the context',
  taskType: 'feature',
  definitionOfDone: ['Tested', 'Documented'],
  riskClass: 'B',
  maxBudgetUsd: 100,
  allowedTools: ['npm', 'git'],
  branchStrategy: 'feature',
  requiresApproval: true,
  privacyMode: 'local',
  createdAt: '2026-05-20T10:00:00Z',
}

const mockDelegation: Delegation = {
  id: 'delegation-1',
  title: 'Test Delegation',
  contract: mockContract,
  status: 'pending',
  executionRoute: 'direct-chat',
  costEstimateUsd: 50,
  createdAt: '2026-05-20T10:00:00Z',
  updatedAt: '2026-05-20T10:00:00Z',
}

const mockUpdatedContract: TaskContract = {
  ...mockContract,
  goal: 'Implement feature X and Y',
  maxBudgetUsd: 150,
}

describe('contract-versions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('saveVersion', () => {
    it('should create first version (v1) for a new delegation', async () => {
      const mockStore = {}
      ;(fs.readFile as any).mockRejectedValue(new Error('not found'))
      ;(fs.mkdir as any).mockResolvedValue(undefined)
      ;(fs.writeFile as any).mockResolvedValue(undefined)

      const version = await cv.saveVersion(
        'delegation-1',
        mockContract,
        mockDelegation,
        'Initial setup'
      )

      expect(version.version).toBe(1)
      expect(version.delegationId).toBe('delegation-1')
      expect(version.title).toBe('Implement feature X')
      expect(version.changeReason).toBe('Initial setup')
      expect(version.id).toBe('delegation-1-v1')
    })

    it('should increment version number for subsequent saves', async () => {
      const mockStore = {
        'delegation-1': [
          {
            id: 'delegation-1-v1',
            delegationId: 'delegation-1',
            version: 1,
            title: 'Old goal',
            description: 'Old context',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T09:00:00Z',
            snapshot: mockContract,
          },
        ],
      }

      ;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockStore))
      ;(fs.mkdir as any).mockResolvedValue(undefined)
      ;(fs.writeFile as any).mockResolvedValue(undefined)

      const version = await cv.saveVersion(
        'delegation-1',
        mockUpdatedContract,
        mockDelegation,
        'Updated budget'
      )

      expect(version.version).toBe(2)
      expect(version.id).toBe('delegation-1-v2')
    })

    it('should calculate diff between old and new contract', async () => {
      ;(fs.readFile as any).mockRejectedValue(new Error('not found'))
      ;(fs.mkdir as any).mockResolvedValue(undefined)
      ;(fs.writeFile as any).mockResolvedValue(undefined)

      // Save v1
      await cv.saveVersion('delegation-1', mockContract, mockDelegation, 'Initial')

      // Now prepare for v2 with changes
      const mockStoreWithV1 = {
        'delegation-1': [
          {
            id: 'delegation-1-v1',
            delegationId: 'delegation-1',
            version: 1,
            title: 'Implement feature X',
            description: 'This is the context',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T09:00:00Z',
            snapshot: mockContract,
          },
        ],
      }

      ;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockStoreWithV1))
      ;(fs.writeFile as any).mockResolvedValue(undefined)

      const version2 = await cv.saveVersion(
        'delegation-1',
        mockUpdatedContract,
        mockDelegation,
        'Updated budget'
      )

      expect(version2.diff).toBeDefined()
      expect(version2.diff?.to.goal).toBe('Implement feature X and Y')
      expect(version2.diff?.to.maxBudgetUsd).toBe(150)
    })
  })

  describe('getVersionHistory', () => {
    it('should return empty array if no versions exist', async () => {
      ;(fs.readFile as any).mockRejectedValue(new Error('not found'))

      const history = await cv.getVersionHistory('delegation-unknown')
      expect(history).toEqual([])
    })

    it('should return all versions for a delegation', async () => {
      const mockStore = {
        'delegation-1': [
          {
            id: 'delegation-1-v1',
            delegationId: 'delegation-1',
            version: 1,
            title: 'Old goal',
            description: 'Old context',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T09:00:00Z',
            snapshot: mockContract,
          },
          {
            id: 'delegation-1-v2',
            delegationId: 'delegation-1',
            version: 2,
            title: 'New goal',
            description: 'New context',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T10:00:00Z',
            snapshot: mockUpdatedContract,
          },
        ],
      }

      ;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockStore))

      const history = await cv.getVersionHistory('delegation-1')
      expect(history).toHaveLength(2)
      expect(history[0].version).toBe(1)
      expect(history[1].version).toBe(2)
    })
  })

  describe('getVersion', () => {
    it('should return specific version by number', async () => {
      const mockStore = {
        'delegation-1': [
          {
            id: 'delegation-1-v1',
            delegationId: 'delegation-1',
            version: 1,
            title: 'Goal v1',
            description: 'Context v1',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T09:00:00Z',
            snapshot: mockContract,
          },
          {
            id: 'delegation-1-v2',
            delegationId: 'delegation-1',
            version: 2,
            title: 'Goal v2',
            description: 'Context v2',
            riskClass: 'A',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T10:00:00Z',
            snapshot: mockUpdatedContract,
          },
        ],
      }

      ;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockStore))

      const v2 = await cv.getVersion('delegation-1', 2)
      expect(v2?.version).toBe(2)
      expect(v2?.title).toBe('Goal v2')
      expect(v2?.riskClass).toBe('A')
    })

    it('should return null if version not found', async () => {
      const mockStore = {
        'delegation-1': [
          {
            id: 'delegation-1-v1',
            delegationId: 'delegation-1',
            version: 1,
            title: 'Goal v1',
            description: 'Context v1',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T09:00:00Z',
            snapshot: mockContract,
          },
        ],
      }

      ;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockStore))

      const v99 = await cv.getVersion('delegation-1', 99)
      expect(v99).toBeNull()
    })
  })

  describe('getLatestVersion', () => {
    it('should return null if no versions exist', async () => {
      ;(fs.readFile as any).mockRejectedValue(new Error('not found'))

      const latest = await cv.getLatestVersion('delegation-unknown')
      expect(latest).toBeNull()
    })

    it('should return the last version in history', async () => {
      const mockStore = {
        'delegation-1': [
          {
            id: 'delegation-1-v1',
            delegationId: 'delegation-1',
            version: 1,
            title: 'Goal v1',
            description: 'Context v1',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T09:00:00Z',
            snapshot: mockContract,
          },
          {
            id: 'delegation-1-v2',
            delegationId: 'delegation-1',
            version: 2,
            title: 'Goal v2',
            description: 'Context v2',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T10:00:00Z',
            snapshot: mockUpdatedContract,
          },
          {
            id: 'delegation-1-v3',
            delegationId: 'delegation-1',
            version: 3,
            title: 'Goal v3',
            description: 'Context v3',
            riskClass: 'B',
            changedBy: 'user' as const,
            changedAt: '2026-05-20T11:00:00Z',
            snapshot: mockUpdatedContract,
          },
        ],
      }

      ;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockStore))

      const latest = await cv.getLatestVersion('delegation-1')
      expect(latest?.version).toBe(3)
      expect(latest?.title).toBe('Goal v3')
    })
  })
})
