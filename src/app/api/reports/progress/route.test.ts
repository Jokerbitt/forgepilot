/**
 * Tests for GET /api/reports/progress
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBriefs = [
  { id: 'b1', title: 'Brief One', status: 'accepted', githubRepoUrl: 'https://github.com/owner/r1', githubRepoName: 'owner/r1', linearProjectId: 'lp-1', linearProjectUrl: 'https://linear.app/p/1' },
  { id: 'b2', title: 'Brief Two', status: 'in_review', githubRepoUrl: undefined, linearProjectId: undefined },
  { id: 'b3', title: 'Brief Three', status: 'draft', githubRepoUrl: undefined, linearProjectId: undefined },
]

const mockMilestones = [
  { id: 'm1', title: 'M1', status: 'completed' },
  { id: 'm2', title: 'M2', status: 'in_progress' },
]

const mockWorkPackages = [
  { id: 'wp1', briefId: 'b1', title: 'WP1', status: 'done', riskClass: 'A', estimatedHours: 2, definitionOfDone: [], tags: [] },
  { id: 'wp2', briefId: 'b1', title: 'WP2', status: 'ready', riskClass: 'A', estimatedHours: 3, definitionOfDone: [], tags: [] },
  { id: 'wp3', briefId: 'b2', title: 'WP3', status: 'backlog', riskClass: 'B', estimatedHours: 4, definitionOfDone: [], tags: [] },
]

const mockDelegations = [
  { id: 'd1', title: 'D1', status: 'completed', executionRoute: 'local-agent', contract: { goal: 'g1' }, logs: [] },
  { id: 'd2', title: 'D2', status: 'completed', executionRoute: 'ollama-agent', contract: { goal: 'g2' }, logs: [] },
  { id: 'd3', title: 'D3', status: 'pending', executionRoute: 'local-agent', contract: { goal: 'g3' }, logs: [] },
  { id: 'd4', title: 'D4', status: 'failed', executionRoute: 'local-agent', contract: { goal: 'g4' }, logs: [] },
]

vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(() => [...mockBriefs]),
}))

vi.mock('@/lib/knowledge/milestone-store', () => ({
  readMilestones: vi.fn(() => [...mockMilestones]),
  readWorkPackages: vi.fn(() => [...mockWorkPackages]),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: vi.fn(async () => [...mockDelegations]),
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({
    github: { token: 'ghp-token' },
    linear: { apiKey: 'lin-key' },
  })),
}))

describe('GET /api/reports/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a valid ProgressReport with all 4 sections', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const report = await res.json() as { sections: Array<{ title: string }>; summary: Record<string, number>; generatedAt: string }
    expect(report.sections).toHaveLength(4)
    expect(report.sections[0].title).toBe('Was wurde bereits gemacht')
    expect(report.sections[1].title).toBe('Was funktioniert gut')
    expect(report.sections[2].title).toBe('Was wurde getestet')
    expect(report.sections[3].title).toBe('Was sollte noch gemacht werden')
  })

  it('summary contains correct delegation counts', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const report = await res.json() as { summary: { completedDelegations: number; pendingDelegations: number; failedDelegations: number } }
    expect(report.summary.completedDelegations).toBe(2)
    expect(report.summary.pendingDelegations).toBe(1)
    expect(report.summary.failedDelegations).toBe(1)
  })

  it('summary contains correct brief counts', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const report = await res.json() as { summary: { totalBriefs: number; acceptedBriefs: number } }
    expect(report.summary.totalBriefs).toBe(3)
    expect(report.summary.acceptedBriefs).toBe(1)
  })

  it('summary contains correct work package counts', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const report = await res.json() as { summary: { workPackagesTotal: number; workPackagesDone: number } }
    expect(report.summary.workPackagesTotal).toBe(3)
    expect(report.summary.workPackagesDone).toBe(1)
  })

  it('shows GitHub and Linear connectors as ok when connected', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const report = await res.json() as { sections: Array<{ items: Array<{ label: string; status: string }> }> }
    const workingSection = report.sections[1]
    const ghItem = workingSection.items.find(i => i.label.includes('GitHub'))
    const linItem = workingSection.items.find(i => i.label.includes('Linear'))
    expect(ghItem?.status).toBe('ok')
    expect(linItem?.status).toBe('ok')
  })

  it('shows GitHub connector as warning when not connected', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockReturnValueOnce({
      github: { token: '' },
      linear: { apiKey: '' },
    } as ReturnType<typeof readConnectorConfigs>)

    const { GET } = await import('./route')
    const res = await GET()
    const report = await res.json() as { sections: Array<{ items: Array<{ label: string; status: string }> }> }
    const workingSection = report.sections[1]
    const ghItem = workingSection.items.find(i => i.label.includes('GitHub'))
    expect(ghItem?.status).toBe('warning')
  })

  it('report includes generatedAt timestamp', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const report = await res.json() as { generatedAt: string }
    expect(typeof report.generatedAt).toBe('string')
    expect(new Date(report.generatedAt).getTime()).toBeGreaterThan(0)
  })

  it('"Was bereits gemacht" shows GitHub repos linked count', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const report = await res.json() as { sections: Array<{ items: Array<{ label: string; count?: number }> }> }
    const doneSection = report.sections[0]
    const repoItem = doneSection.items.find(i => i.label.includes('GitHub Repos'))
    expect(repoItem?.count).toBe(1) // only brief-1 has githubRepoUrl
  })
})
