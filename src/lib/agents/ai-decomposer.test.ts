import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mock generateText ────────────────────────────────────────────────────────

vi.mock('@/lib/ai/text-generation', () => ({
  generateText: vi.fn(),
  stripJsonCodeFence: vi.fn((text: string) => text),
}))

vi.mock('./atomic-task', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./atomic-task')>()
  return {
    ...actual,
    decomposeTask: vi.fn(() => [
      {
        id: 'fallback-0',
        title: 'Fallback task',
        description: 'Pattern-based fallback',
        acceptanceCriteria: ['done'],
        skillCategory: 'refactor',
        assignedAgentType: 'claude-code',
        filePatterns: ['src/**/*'],
        effort: 'M',
        dependsOn: [],
        order: 0,
      },
    ]),
  }
})

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeRawTasks() {
  return [
    {
      title: 'Add JWT middleware',
      description: 'Validate Bearer tokens on all API routes',
      acceptanceCriteria: ['Returns 401 for invalid token', 'Passes for valid token'],
      skillCategory: 'api-route',
      assignedAgentType: 'claude-code',
      filePatterns: ['src/app/api/**/*.ts'],
      effort: 'S',
      dependsOn: [],
    },
    {
      title: 'Write auth tests',
      description: 'Cover happy + error paths',
      acceptanceCriteria: ['≥ 5 tests', 'All pass'],
      skillCategory: 'test',
      assignedAgentType: 'claude-code',
      filePatterns: ['src/**/*.test.ts'],
      effort: 'S',
      dependsOn: [],
    },
  ]
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('decomposeWithAI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns parsed tasks when AI responds with valid JSON', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(makeRawTasks()),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Add JWT authentication')
    expect(tasks).toHaveLength(2)
    expect(tasks[0].title).toBe('Add JWT middleware')
  })

  it('assigns sequential order to each task', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(makeRawTasks()),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks[0].order).toBe(0)
    expect(tasks[1].order).toBe(1)
  })

  it('each task has a unique id prefixed with ai-task-', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(makeRawTasks()),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    for (const task of tasks) {
      expect(task.id).toMatch(/^ai-task-\d+-\d+$/)
    }
    const ids = tasks.map(t => t.id)
    expect(new Set(ids).size).toBe(tasks.length)
  })

  it('passes goal as prompt to generateText', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(makeRawTasks()),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    await decomposeWithAI('Build payment flow')
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining('Build payment flow') }),
    )
  })

  it('includes context in prompt when provided', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify([makeRawTasks()[0]]),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    await decomposeWithAI('Goal', 'Use Stripe for payments')
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Use Stripe for payments'),
      }),
    )
  })

  it('uses purpose fast for speed', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify([makeRawTasks()[0]]),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    await decomposeWithAI('Goal')
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'fast' }),
    )
  })

  it('maps skillCategory correctly', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(makeRawTasks()),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks[0].skillCategory).toBe('api-route')
    expect(tasks[1].skillCategory).toBe('test')
  })

  it('maps effort correctly', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(makeRawTasks()),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks[0].effort).toBe('S')
  })

  it('defaults effort to M for invalid value', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    const raw = [{ ...makeRawTasks()[0], effort: 'HUGE' }]
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(raw),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks[0].effort).toBe('M')
  })

  it('defaults title to "Task N" when missing', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    const raw = [{ skillCategory: 'api-route', assignedAgentType: 'claude-code' }]
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(raw),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('My goal')
    expect(tasks[0].title).toBe('Task 1')
  })

  it('defaults description to goal when missing', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    const raw = [{ title: 'A task' }]
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(raw),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('My goal')
    expect(tasks[0].description).toBe('My goal')
  })

  it('defaults filePatterns to src/**/* when missing', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    const raw = [{ title: 'Task', skillCategory: 'api-route' }]
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(raw),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks[0].filePatterns).toEqual(['src/**/*'])
  })

  it('falls back to decomposeTask when generateText throws', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockRejectedValueOnce(new Error('API error'))
    const { decomposeTask } = await import('./atomic-task')
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(decomposeTask).toHaveBeenCalled()
    expect(tasks.length).toBeGreaterThan(0)
  })

  it('falls back when AI returns empty array', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '[]',
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks).toBeDefined()
    expect(tasks.length).toBeGreaterThan(0)
  })

  it('falls back when AI returns invalid JSON', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'not json at all',
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks).toBeDefined()
    expect(tasks.length).toBeGreaterThan(0)
  })

  it('falls back when AI returns a non-array JSON value', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"error": "unexpected"}',
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks).toBeDefined()
    expect(tasks.length).toBeGreaterThan(0)
  })

  it('defaults skillCategory to infrastructure when missing', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    const raw = [{ title: 'T', description: 'D', acceptanceCriteria: [] }]
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(raw),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks[0].skillCategory).toBe('infrastructure')
  })

  it('defaults assignedAgentType to claude-code when missing', async () => {
    const { generateText } = await import('@/lib/ai/text-generation')
    const raw = [{ title: 'T', description: 'D', acceptanceCriteria: [] }]
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(raw),
      provider: 'anthropic', model: 'claude-haiku-4-5',
    })
    vi.resetModules()
    const { decomposeWithAI } = await import('./ai-decomposer')
    const tasks = await decomposeWithAI('Goal')
    expect(tasks[0].assignedAgentType).toBe('claude-code')
  })
})
