import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── fs mock ────────────────────────────────────────────────────────────────

let mockLocalItems = '[]'
let mockDelegations = '[]'

const fsMock = {
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn((p: string) => {
    if (String(p).includes('local-items.json')) return mockLocalItems
    if (String(p).includes('delegations.json')) return mockDelegations
    if (String(p).includes('project-briefs.json')) return '[]'
    return '[]'
  }),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}
vi.mock('fs', () => ({ default: fsMock, ...fsMock }))

// ─── AI mocks ────────────────────────────────────────────────────────────────

const mockGenerateText = vi.fn()
vi.mock('@/lib/ai/text-generation', () => ({
  generateText: mockGenerateText,
  stripJsonCodeFence: (s: string) => s,
}))

const mockDecomposeWithAI = vi.fn()
vi.mock('@/lib/agents/ai-decomposer', () => ({
  decomposeWithAI: mockDecomposeWithAI,
}))

const mockCreateRun = vi.fn()
vi.mock('@/lib/agents/orchestrated-run', () => ({
  createRun: mockCreateRun,
}))

// ─── project-briefs mock ──────────────────────────────────────────────────────

const mockBuildProjectBrief = vi.fn()
const mockSaveProjectBrief = vi.fn()
vi.mock('@/lib/project-briefs', () => ({
  buildProjectBrief: mockBuildProjectBrief,
  saveProjectBrief: mockSaveProjectBrief,
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/pilot/idea-to-production', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const MOCK_BRIEF = {
  id: 'brief-123',
  title: 'Test Brief',
  problemStatement: 'A test problem',
  desiredOutcome: 'A test outcome',
}

const MOCK_TASKS = [
  {
    id: 'task-1',
    title: 'Setup project structure',
    description: 'Create folders and files',
    acceptanceCriteria: ['Folders exist'],
    skillCategory: 'infrastructure' as const,
    filePatterns: ['src/**'],
    size: 'S' as const,
    estimatedMinutes: 30,
    dependencies: [],
  },
]

const MOCK_RUN = {
  id: 'run-abc',
  delegationId: 'del-idea-123',
  delegationTitle: 'Test task',
  status: 'planning' as const,
  tasks: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/pilot/idea-to-production', () => {
  beforeEach(() => {
    vi.resetModules()
    mockLocalItems = '[]'
    mockDelegations = '[]'
    vi.clearAllMocks()

    mockBuildProjectBrief.mockReturnValue(MOCK_BRIEF)
    mockSaveProjectBrief.mockReturnValue(MOCK_BRIEF)
    mockDecomposeWithAI.mockResolvedValue(MOCK_TASKS)
    mockCreateRun.mockReturnValue(MOCK_RUN)
  })

  it('returns 400 when idea is missing', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('idea is required')
  })

  it('returns 400 when idea is empty string', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ idea: '   ' }))
    expect(res.status).toBe(400)
  })

  it('uses AI fallback for expandIdea when generateText throws', async () => {
    // First call (expandIdea) throws, second call (generateWorkItems) succeeds with items
    mockGenerateText
      .mockRejectedValueOnce(new Error('AI unavailable'))
      .mockResolvedValueOnce({
        text: JSON.stringify([
          { title: 'Implement feature', type: 'ticket', priority: 1, estimatedMinutes: 45, risk: 'A' },
        ]),
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
      })

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ idea: 'Build a CLI tool for markdown links' }))

    expect(res.status).toBe(201)
    const data = await res.json() as { briefTitle: string; workItemCount: number }
    expect(data.briefTitle).toBeTruthy()
    expect(data.workItemCount).toBeGreaterThanOrEqual(1)
    // buildProjectBrief was still called (with fallback input)
    expect(mockBuildProjectBrief).toHaveBeenCalledOnce()
  })

  it('uses fallback WorkItems when generateWorkItems AI call fails', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: 'Slack Daily Report Bot',
          rawIdea: 'Build a Slack bot',
          problemStatement: 'No daily reports',
          targetAudience: 'Dev teams',
          desiredOutcome: 'Automated reports',
          constraints: [],
          scope: 'minimal',
          researchMode: 'quick',
          privacyMode: 'local',
        }),
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
      })
      .mockRejectedValueOnce(new Error('Work item generation failed'))

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ idea: 'Build a Slack bot for daily reports' }))

    expect(res.status).toBe(201)
    const data = await res.json() as { workItemCount: number }
    // Fallback produces exactly 1 item
    expect(data.workItemCount).toBe(1)
  })

  it('full pipeline returns all expected fields', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: 'GitHub PR Dashboard',
          rawIdea: 'Dashboard for PRs',
          problemStatement: 'No PR visibility',
          targetAudience: 'Dev teams',
          desiredOutcome: 'Sorted PR view',
          constraints: ['Read-only'],
          scope: 'minimal',
          researchMode: 'quick',
          privacyMode: 'local',
        }),
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify([
          { title: 'Setup Next.js app', type: 'ticket', priority: 1, estimatedMinutes: 60, risk: 'A' },
          { title: 'Integrate GitHub API', type: 'ticket', priority: 2, estimatedMinutes: 45, risk: 'A' },
        ]),
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
      })

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ idea: 'Dashboard for GitHub PRs sorted by age' }))

    expect(res.status).toBe(201)
    const data = await res.json() as {
      briefId: string
      briefTitle: string
      workItemCount: number
      topItem: { title: string; estimatedMinutes: number }
      delegation: { id: string; title: string }
      run: { id: string }
      taskCount: number
    }

    expect(data.briefId).toBe('brief-123')
    expect(data.briefTitle).toBe('Test Brief')
    expect(data.workItemCount).toBe(2)
    expect(data.topItem).toMatchObject({ title: expect.any(String) })
    expect(data.delegation.id).toMatch(/^del-idea-/)
    expect(data.run.id).toBe('run-abc')
    expect(data.taskCount).toBe(1) // MOCK_TASKS has 1 task
  })

  it('prepends new items before existing local-items', async () => {
    const existingItem = {
      id: 'old-item',
      source: 'local',
      type: 'ticket',
      title: 'Existing task',
      url: '',
      status: 'todo',
      priority: 1,
      blocked: false,
      risk: 'A',
      aiDelegable: true,
      projectId: 'old-project',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    mockLocalItems = JSON.stringify([existingItem])

    mockGenerateText.mockResolvedValue({
      text: JSON.stringify([
        { title: 'New task', type: 'ticket', priority: 1, estimatedMinutes: 30, risk: 'A' },
      ]),
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    })

    const { POST } = await import('./route')
    await POST(makeRequest({ idea: 'Build something new' }))

    // writeFileSync should have been called with new items prepended before existing
    const writeCall = fsMock.writeFileSync.mock.calls.find(
      (c) => String(c[0]).includes('local-items')
    )
    expect(writeCall).toBeTruthy()
    const written = JSON.parse(String(writeCall![1])) as Array<{ title: string }>
    expect(written[0].title).toBe('New task')
    expect(written[written.length - 1].title).toBe('Existing task')
  })

  it('persists delegation to delegations.json', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify([
        { title: 'Deploy service', type: 'ticket', priority: 1, estimatedMinutes: 60, risk: 'A' },
      ]),
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    })

    const { POST } = await import('./route')
    await POST(makeRequest({ idea: 'Deploy a microservice' }))

    const writeCall = fsMock.writeFileSync.mock.calls.find(
      (c) => String(c[0]).includes('delegations')
    )
    expect(writeCall).toBeTruthy()
    const written = JSON.parse(String(writeCall![1])) as Array<{ id: string; status: string }>
    expect(written.length).toBeGreaterThan(0)
    expect(written[0].status).toBe('approved')
    expect(written[0].id).toMatch(/^del-idea-/)
  })

  it('calls decomposeWithAI with goal and context', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify([
        { title: 'Build CLI', type: 'ticket', priority: 1, estimatedMinutes: 45, risk: 'A' },
      ]),
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    })

    const { POST } = await import('./route')
    await POST(makeRequest({ idea: 'CLI for markdown link checking' }))

    expect(mockDecomposeWithAI).toHaveBeenCalledOnce()
    const [goal, context] = mockDecomposeWithAI.mock.calls[0] as [string, string]
    expect(typeof goal).toBe('string')
    expect(goal.length).toBeGreaterThan(0)
    expect(typeof context).toBe('string')
  })
})
