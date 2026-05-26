import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkPackage } from '@/lib/models/milestone'

const mockBrief = {
  id: 'brief-1',
  title: 'My App',
  problemStatement: 'No solution',
  createdAt: '2024-01-01T00:00:00.000Z',
  targetPlatform: 'webapp',
  persistenceStrategy: 'postgres',
}

const mockWorkPackages: WorkPackage[] = [
  {
    id: 'wp-1',
    briefId: 'brief-1',
    milestoneId: 'ms-1',
    title: 'Build main screen',
    description: 'First screen',
    status: 'ready',
    riskClass: 'A',
    estimatedHours: 4,
    definitionOfDone: ['Screen loads'],
    tags: ['frontend'],
    priority: 'critical',
    dependsOn: [],
    delegationIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'wp-2',
    briefId: 'brief-1',
    milestoneId: 'ms-1',
    title: 'Add persistence',
    description: 'Store data',
    status: 'backlog',
    riskClass: 'B',
    estimatedHours: 6,
    definitionOfDone: ['Data persists'],
    tags: ['backend'],
    priority: 'high',
    dependsOn: [],
    delegationIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'wp-c',
    briefId: 'brief-1',
    milestoneId: 'ms-1',
    title: 'Risk C task',
    description: 'Dangerous',
    status: 'ready',
    riskClass: 'C',
    estimatedHours: 8,
    definitionOfDone: ['Done'],
    tags: [],
    priority: 'medium',
    dependsOn: [],
    delegationIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
]

const mockMilestones = [{ id: 'ms-1', briefId: 'brief-1', title: 'M1', status: 'planned' }]

const mockCreate = vi.fn(async (d: unknown) => d)

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn(),
}))

vi.mock('@/lib/knowledge/milestone-store', () => ({
  getMilestonesByBriefId: vi.fn(),
  getWorkPackagesByBriefId: vi.fn(),
  persistGeneratedPlan: vi.fn((id: string, milestones: unknown[], workPackages: unknown[]) => ({ milestones, workPackages })),
}))

vi.mock('@/lib/delegations/queue', () => ({
  readDelegations: vi.fn(() => []),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    create: mockCreate,
    listByStatus: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('child_process', () => ({
  execSync: vi.fn(() => Buffer.from('claude 1.0.0')),
}))

vi.mock('@/lib/project-starter-plan', () => ({
  buildStarterPlan: vi.fn(() => ({
    milestones: mockMilestones,
    workPackages: mockWorkPackages,
  })),
}))

describe('POST /api/projects/[id]/autopilot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockImplementation(async (d: unknown) => d)
  })

  it('returns 404 when project brief is not found', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValue(undefined)

    const { POST } = await import('./route')
    const res = await POST({} as Request, { params: Promise.resolve({ id: 'unknown' }) })

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Projekt nicht gefunden')
  })

  it('generates starter plan when milestones are empty', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    const { getMilestonesByBriefId, getWorkPackagesByBriefId } = await import('@/lib/knowledge/milestone-store')
    const { buildStarterPlan } = await import('@/lib/project-starter-plan')

    vi.mocked(findProjectBriefById).mockReturnValue(mockBrief as ReturnType<typeof findProjectBriefById>)
    vi.mocked(getMilestonesByBriefId).mockReturnValue([])
    vi.mocked(getWorkPackagesByBriefId).mockReturnValue([])

    const { POST } = await import('./route')
    await POST({} as Request, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(buildStarterPlan).toHaveBeenCalledWith(mockBrief)
  })

  it('creates delegation for first safe work package', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    const { getMilestonesByBriefId, getWorkPackagesByBriefId } = await import('@/lib/knowledge/milestone-store')

    vi.mocked(findProjectBriefById).mockReturnValue(mockBrief as ReturnType<typeof findProjectBriefById>)
    vi.mocked(getMilestonesByBriefId).mockReturnValue(mockMilestones as ReturnType<typeof getMilestonesByBriefId>)
    vi.mocked(getWorkPackagesByBriefId).mockReturnValue(mockWorkPackages)

    const { POST } = await import('./route')
    const res = await POST({} as Request, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json() as { delegationId: string; actions: string[]; nextHref: string }
    expect(body.delegationId).toBeDefined()
    expect(body.nextHref).toContain('/delegations/')
    expect(body.actions.some(a => a.includes('Delegation'))).toBe(true)
  })

  it('never creates delegation for Risk Class C work package', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    const { getMilestonesByBriefId, getWorkPackagesByBriefId } = await import('@/lib/knowledge/milestone-store')

    const riskCOnly: WorkPackage[] = [mockWorkPackages[2]] // only the riskClass C package
    vi.mocked(findProjectBriefById).mockReturnValue(mockBrief as ReturnType<typeof findProjectBriefById>)
    vi.mocked(getMilestonesByBriefId).mockReturnValue(mockMilestones as ReturnType<typeof getMilestonesByBriefId>)
    vi.mocked(getWorkPackagesByBriefId).mockReturnValue(riskCOnly)

    const { POST } = await import('./route')
    const res = await POST({} as Request, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json() as { delegationId: unknown; actions: string[] }
    expect(body.delegationId).toBeUndefined()
    expect(body.actions.some(a => a.toLowerCase().includes('kein sicheres arbeitspaket'))).toBe(true)
  })

  it('skips duplicate delegation for already linked work package', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    const { getMilestonesByBriefId, getWorkPackagesByBriefId } = await import('@/lib/knowledge/milestone-store')
    const { readDelegations } = await import('@/lib/delegations/queue')

    vi.mocked(findProjectBriefById).mockReturnValue(mockBrief as ReturnType<typeof findProjectBriefById>)
    vi.mocked(getMilestonesByBriefId).mockReturnValue(mockMilestones as ReturnType<typeof getMilestonesByBriefId>)
    vi.mocked(getWorkPackagesByBriefId).mockReturnValue(mockWorkPackages)
    vi.mocked(readDelegations).mockReturnValue([
      { briefId: 'brief-1', contract: { workItemId: 'wp-1' } } as ReturnType<typeof readDelegations>[number],
      { briefId: 'brief-1', contract: { workItemId: 'wp-2' } } as ReturnType<typeof readDelegations>[number],
    ])

    const { POST } = await import('./route')
    const res = await POST({} as Request, { params: Promise.resolve({ id: 'brief-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json() as { delegationId: unknown; actions: string[] }
    expect(body.delegationId).toBeUndefined()
    expect(body.actions.some(a => a.includes('Duplikat'))).toBe(true)
  })

  it('returns project milestone and work package counts', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    const { getMilestonesByBriefId, getWorkPackagesByBriefId } = await import('@/lib/knowledge/milestone-store')

    vi.mocked(findProjectBriefById).mockReturnValue(mockBrief as ReturnType<typeof findProjectBriefById>)
    vi.mocked(getMilestonesByBriefId).mockReturnValue(mockMilestones as ReturnType<typeof getMilestonesByBriefId>)
    vi.mocked(getWorkPackagesByBriefId).mockReturnValue(mockWorkPackages)

    const { POST } = await import('./route')
    const res = await POST({} as Request, { params: Promise.resolve({ id: 'brief-1' }) })

    const body = await res.json() as { milestones: number; workPackages: number; projectId: string }
    expect(body.milestones).toBe(1)
    expect(body.workPackages).toBe(3)
    expect(body.projectId).toBe('brief-1')
  })

  it('returns nextHref pointing to project page when no delegation was created', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    const { getMilestonesByBriefId, getWorkPackagesByBriefId } = await import('@/lib/knowledge/milestone-store')

    vi.mocked(findProjectBriefById).mockReturnValue(mockBrief as ReturnType<typeof findProjectBriefById>)
    vi.mocked(getMilestonesByBriefId).mockReturnValue(mockMilestones as ReturnType<typeof getMilestonesByBriefId>)
    vi.mocked(getWorkPackagesByBriefId).mockReturnValue([mockWorkPackages[2]]) // only Risk C

    const { POST } = await import('./route')
    const res = await POST({} as Request, { params: Promise.resolve({ id: 'brief-1' }) })

    const body = await res.json() as { nextHref: string }
    expect(body.nextHref).toBe('/projects/brief-1')
  })
})
