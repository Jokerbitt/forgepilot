import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── fs mock ────────────────────────────────────────────────────────────────

let mockLocalItems = '[]'
let mockDelegations = '[]'

const fsMock = {
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn((p: string) => {
    if (String(p).includes('local-items.json')) return mockLocalItems
    if (String(p).includes('delegations.json')) return mockDelegations
    return '[]'
  }),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}
vi.mock('fs', () => ({ default: fsMock, ...fsMock }))

const mockDecomposeWithAI = vi.fn()
vi.mock('@/lib/agents/ai-decomposer', () => ({
  decomposeWithAI: mockDecomposeWithAI,
}))

const mockCreateRun = vi.fn()
vi.mock('@/lib/agents/orchestrated-run', () => ({
  createRun: mockCreateRun,
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_TASK = {
  id: 'task-1', title: 'Do something', description: 'desc',
  acceptanceCriteria: ['done'], skillCategory: 'api-route' as const,
  filePatterns: ['src/**'], size: 'S' as const, estimatedMinutes: 30, dependencies: [],
}
const MOCK_RUN = {
  id: 'run-1', delegationId: 'del-1', delegationTitle: 'Test', goal: 'test',
  status: 'planning' as const, tasks: [], currentTaskIndex: 0, maxRetries: 2,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}

function makeItem(overrides: Partial<{
  id: string; title: string; priority: 0 | 1 | 2 | 3 | 4; status: string; aiDelegable: boolean; blocked: boolean
}> = {}) {
  return {
    id: overrides.id ?? 'item-1',
    source: 'local' as const,
    type: 'ticket' as const,
    title: overrides.title ?? 'Fix something',
    url: '',
    projectId: 'proj-1',
    status: (overrides.status ?? 'todo') as 'todo',
    priority: (overrides.priority ?? 1) as 0 | 1 | 2 | 3 | 4,
    blocked: overrides.blocked ?? false,
    risk: 'A' as const,
    aiDelegable: overrides.aiDelegable ?? true,
    estimatedMinutes: 45,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/pilot/auto-run', () => {
  beforeEach(() => {
    mockLocalItems = '[]'
    mockDelegations = '[]'
    vi.resetAllMocks()
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockImplementation((p: string) => {
      if (String(p).includes('local-items.json')) return mockLocalItems
      if (String(p).includes('delegations.json')) return mockDelegations
      return '[]'
    })
    mockDecomposeWithAI.mockResolvedValue([MOCK_TASK])
    mockCreateRun.mockReturnValue(MOCK_RUN)
  })

  it('returns 422 when no AI-delegable items exist', async () => {
    mockLocalItems = '[]'
    const { POST } = await import('./route')
    const res = await POST()
    expect(res.status).toBe(422)
    const data = await res.json() as { error: string }
    expect(data.error).toMatch(/No AI-delegable/)
  })

  it('skips blocked items', async () => {
    mockLocalItems = JSON.stringify([makeItem({ blocked: true })])
    const { POST } = await import('./route')
    const res = await POST()
    expect(res.status).toBe(422)
  })

  it('skips done items', async () => {
    mockLocalItems = JSON.stringify([makeItem({ status: 'done' })])
    const { POST } = await import('./route')
    const res = await POST()
    expect(res.status).toBe(422)
  })

  it('skips non-aiDelegable items', async () => {
    mockLocalItems = JSON.stringify([makeItem({ aiDelegable: false })])
    const { POST } = await import('./route')
    const res = await POST()
    expect(res.status).toBe(422)
  })

  it('picks item with lowest priority number', async () => {
    mockLocalItems = JSON.stringify([
      makeItem({ id: 'low', priority: 2, title: 'Low priority' }),
      makeItem({ id: 'high', priority: 0, title: 'High priority' }),
    ])
    const { POST } = await import('./route')
    const res = await POST()
    expect(res.status).toBe(201)
    const data = await res.json() as { delegation: { title: string } }
    expect(data.delegation.title).toBe('High priority')
  })

  it('returns delegation, run and taskCount on success', async () => {
    mockLocalItems = JSON.stringify([makeItem()])
    const { POST } = await import('./route')
    const res = await POST()
    expect(res.status).toBe(201)
    const data = await res.json() as { delegation: { id: string; status: string }; run: { id: string }; taskCount: number }
    expect(data.delegation.id).toMatch(/^del-autopilot-/)
    expect(data.delegation.status).toBe('approved')
    expect(data.run.id).toBe('run-1')
    expect(data.taskCount).toBe(1)
  })

  it('persists delegation to delegations.json', async () => {
    mockLocalItems = JSON.stringify([makeItem()])
    const { POST } = await import('./route')
    await POST()
    const writeCall = fsMock.writeFileSync.mock.calls.find(
      c => String(c[0]).includes('delegations')
    )
    expect(writeCall).toBeTruthy()
    const written = JSON.parse(String(writeCall![1])) as Array<{ id: string }>
    expect(written[0].id).toMatch(/^del-autopilot-/)
  })

  it('calls decomposeWithAI with item title', async () => {
    mockLocalItems = JSON.stringify([makeItem({ title: 'Build the thing' })])
    const { POST } = await import('./route')
    await POST()
    expect(mockDecomposeWithAI).toHaveBeenCalledWith('Build the thing', undefined)
  })
})
