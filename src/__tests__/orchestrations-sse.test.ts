/**
 * Tests for the SSE orchestrations stream endpoint.
 *
 * We unit-test the route handler in isolation by mocking the run store so no
 * real filesystem I/O is needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_RUN: OrchestratedRun = {
  id: 'run-123',
  delegationId: 'del-1',
  delegationTitle: 'Test Delegation',
  goal: 'Build something great',
  status: 'planning',
  tasks: [],
  currentTaskIndex: 0,
  maxRetries: 2,
  createdAt: '2026-05-20T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z',
}

// ─── Mock the store ────────────────────────────────────────────────────────────

vi.mock('@/lib/agents/orchestrated-run', () => ({
  listRuns: vi.fn(() => [MOCK_RUN]),
}))

import { listRuns } from '@/lib/agents/orchestrated-run'

// ─── Import route after mock ───────────────────────────────────────────────────

import { GET } from '@/app/api/orchestrations/stream/route'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SSE /api/orchestrations/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listRuns).mockReturnValue([MOCK_RUN])
  })

  it('sets correct SSE response headers', async () => {
    const controller = new AbortController()
    const req = new Request('http://localhost/api/orchestrations/stream', {
      signal: controller.signal,
    })

    const response = await GET(req)
    controller.abort() // clean up immediately

    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('Connection')).toBe('keep-alive')
  })

  it('emits an initial runs event with correct format', async () => {
    const controller = new AbortController()
    const req = new Request('http://localhost/api/orchestrations/stream', {
      signal: controller.signal,
    })

    const response = await GET(req)

    // Read the first chunk from the stream
    const reader = response.body!.getReader()
    const { value } = await reader.read()
    controller.abort()
    reader.releaseLock()

    const text = new TextDecoder().decode(value)

    expect(text).toContain('event: runs')
    expect(text).toContain('data: ')
    // Should be valid SSE format: event line + data line + blank line
    expect(text).toMatch(/^event: runs\ndata: .+\n\n/)
  })

  it('serializes runs array correctly in the data payload', async () => {
    const controller = new AbortController()
    const req = new Request('http://localhost/api/orchestrations/stream', {
      signal: controller.signal,
    })

    const response = await GET(req)
    const reader = response.body!.getReader()
    const { value } = await reader.read()
    controller.abort()
    reader.releaseLock()

    const text = new TextDecoder().decode(value)

    // Extract the JSON payload from the data line
    const dataLine = text.split('\n').find(line => line.startsWith('data: '))
    expect(dataLine).toBeDefined()

    const payload = JSON.parse(dataLine!.slice('data: '.length)) as OrchestratedRun[]

    expect(Array.isArray(payload)).toBe(true)
    expect(payload).toHaveLength(1)
    expect(payload[0].id).toBe('run-123')
    expect(payload[0].status).toBe('planning')
    expect(payload[0].goal).toBe('Build something great')
  })

  it('calls listRuns to fetch the current run store', async () => {
    const controller = new AbortController()
    const req = new Request('http://localhost/api/orchestrations/stream', {
      signal: controller.signal,
    })

    await GET(req)
    controller.abort()

    expect(listRuns).toHaveBeenCalled()
  })
})
