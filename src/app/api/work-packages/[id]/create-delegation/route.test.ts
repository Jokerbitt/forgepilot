import { describe, it, expect, vi } from 'vitest'
import { POST } from './route'
import type { WorkPackage } from '@/lib/models/milestone'

const baseWp: WorkPackage = {
  id: 'wp-test-001',
  milestoneId: 'ms-001',
  briefId: 'brief-001',
  title: 'Build auth module',
  description: 'Implement JWT-based authentication',
  definitionOfDone: ['Tests pass', 'PR reviewed'],
  riskClass: 'B',
  priority: 'high',
  estimatedHours: 8,
  dependsOn: [],
  status: 'ready',
  delegationIds: [],
  tags: ['backend', 'security'],
  createdAt: '2026-05-18T00:00:00Z',
  updatedAt: '2026-05-18T00:00:00Z',
}

const mockWorkPackages: WorkPackage[] = [baseWp]

vi.mock('@/lib/knowledge/milestone-store', () => ({
  readWorkPackages: vi.fn(() => mockWorkPackages),
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: vi.fn((_path: string) => '[]'),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    existsSync: vi.fn((_path: string) => true),
    mkdirSync: vi.fn(),
  }
})

const makeParams = (id: string) => ({ params: { id } })

describe('POST /api/work-packages/[id]/create-delegation', () => {
  it('creates a delegation from a valid work package', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('wp-test-001'))

    expect(res.status).toBe(201)
    const data = await res.json() as {
      delegationId: string
      delegation: {
        title: string
        contract: {
          goal: string
          riskClass: string
          branchStrategy: string
          requiresApproval: boolean
          maxBudgetUsd: number
          taskType: string
          definitionOfDone: string[]
          privacyMode: string
          allowedTools: string[]
        }
        status: string
        executionRoute: string
      }
    }

    expect(data.delegationId).toBeDefined()
    expect(data.delegation.title).toBe('Build auth module')
    expect(data.delegation.contract.goal).toBe('Implement JWT-based authentication')
    expect(data.delegation.contract.riskClass).toBe('B')
    expect(data.delegation.contract.branchStrategy).toBe('feature')
    expect(data.delegation.contract.requiresApproval).toBe(false)
    expect(data.delegation.contract.maxBudgetUsd).toBe(4)
    expect(data.delegation.contract.taskType).toBe('feature')
    expect(data.delegation.contract.definitionOfDone).toEqual(['Tests pass', 'PR reviewed'])
    expect(data.delegation.contract.privacyMode).toBe('local')
    expect(data.delegation.contract.allowedTools).toEqual(['bash', 'read_file', 'write_file'])
    expect(data.delegation.status).toBe('pending')
    expect(data.delegation.executionRoute).toBe('ollama-agent')
  })

  it('returns 404 for unknown work package', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('wp-not-found'))
    expect(res.status).toBe(404)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('Work Package nicht gefunden')
  })

  it('sets requiresApproval true and branchStrategy fix for riskClass C', async () => {
    const { readWorkPackages } = await import('@/lib/knowledge/milestone-store')
    vi.mocked(readWorkPackages).mockReturnValueOnce([{ ...baseWp, id: 'wp-risky', riskClass: 'C' }])

    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('wp-risky'))
    expect(res.status).toBe(201)
    const data = await res.json() as { delegation: { contract: { requiresApproval: boolean; branchStrategy: string } } }
    expect(data.delegation.contract.requiresApproval).toBe(true)
    expect(data.delegation.contract.branchStrategy).toBe('fix')
  })

  it('sets taskType bugfix when tags include test', async () => {
    const { readWorkPackages } = await import('@/lib/knowledge/milestone-store')
    vi.mocked(readWorkPackages).mockReturnValueOnce([{ ...baseWp, id: 'wp-test-tagged', tags: ['test', 'ci'] }])

    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('wp-test-tagged'))
    expect(res.status).toBe(201)
    const data = await res.json() as { delegation: { contract: { taskType: string } } }
    expect(data.delegation.contract.taskType).toBe('bugfix')
  })

  it('enforces minimum maxBudgetUsd of 1.0 for very small estimated hours', async () => {
    const { readWorkPackages } = await import('@/lib/knowledge/milestone-store')
    vi.mocked(readWorkPackages).mockReturnValueOnce([{ ...baseWp, id: 'wp-tiny', estimatedHours: 0 }])

    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('wp-tiny'))
    expect(res.status).toBe(201)
    const data = await res.json() as { delegation: { contract: { maxBudgetUsd: number } } }
    expect(data.delegation.contract.maxBudgetUsd).toBe(1.0)
  })
})
