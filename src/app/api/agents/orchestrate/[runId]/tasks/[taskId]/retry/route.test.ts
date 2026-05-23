import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/orchestrated-run', () => ({
  retryTask: vi.fn(),
  canRetry: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agents/orchestrate/[runId]/tasks/[taskId]/retry', () => {
  it('retries task and returns updated run', async () => {
    const { canRetry, retryTask } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(canRetry).mockReturnValue(true)
    vi.mocked(retryTask).mockReturnValue({ id: 'run-1', tasks: [] } as unknown as ReturnType<typeof retryTask>)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ runId: 'run-1', taskId: 'task-1' }),
    })
    const body = await res.json() as { ok: boolean; run: unknown }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns 400 when task cannot be retried', async () => {
    const { canRetry } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(canRetry).mockReturnValue(false)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ runId: 'run-1', taskId: 'task-1' }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 404 when run not found', async () => {
    const { canRetry, retryTask } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(canRetry).mockReturnValue(true)
    vi.mocked(retryTask).mockReturnValue(null as unknown as ReturnType<typeof retryTask>)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ runId: 'missing', taskId: 'task-1' }),
    })

    expect(res.status).toBe(404)
  })
})
