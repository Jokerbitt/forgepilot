import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAppendEvidence, mockReadEvidence, mockRequireAuth } = vi.hoisted(() => ({
  mockAppendEvidence: vi.fn(),
  mockReadEvidence: vi.fn(),
  mockRequireAuth: vi.fn(),
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/reports/execute-loop-evidence-store', () => ({
  appendExecuteLoopEvidence: mockAppendEvidence,
  readExecuteLoopEvidence: mockReadEvidence,
}))

import { GET, POST } from './route'

function request(body: unknown): Request {
  return new Request('http://localhost/api/execute-loop/evidence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/execute-loop/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(null)
    mockReadEvidence.mockReturnValue([])
    mockAppendEvidence.mockImplementation(run => [run])
  })

  it('lists evidence runs with safe summary counts', async () => {
    mockReadEvidence.mockReturnValue([
      {
        id: 'real-1',
        title: 'Real run',
        status: 'success',
        source: 'manual',
        recordedAt: 'now',
        steps: {
          brief: true,
          delegation: true,
          execute: true,
          tests: true,
          pr: true,
          critic: true,
          writeback: true,
        },
      },
      {
        id: 'dry-1',
        title: 'Dry run',
        status: 'success',
        source: 'harness-dry-run',
        recordedAt: 'now',
        steps: {
          brief: true,
          delegation: true,
          execute: true,
          tests: true,
          pr: true,
          critic: true,
          writeback: true,
        },
      },
    ])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.count).toBe(2)
    expect(body.provenRuns).toBe(1)
    expect(body.dryRuns).toBe(1)
    expect(body.summary.releaseGate.ready).toBe(false)
    expect(body.summary.releaseGate.remainingProvenRuns).toBe(4)
    expect(body.summary.nextAction).toContain('4 more real small ticket loops')
  })

  it('records validated manual evidence', async () => {
    const response = await POST(request({
      title: 'Real settings test ticket',
      status: 'success',
      source: 'manual',
      prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/428',
      steps: {
        brief: true,
        delegation: true,
        execute: true,
        tests: true,
        pr: true,
        critic: true,
        writeback: true,
      },
    }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(mockAppendEvidence).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Real settings test ticket',
      source: 'manual',
      prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/428',
    }))
    expect(body.recorded.id).toMatch(/^evidence-/)
    expect(body.summary.provenRuns).toBe(1)
    expect(body.summary.releaseGate.ready).toBe(false)
  })

  it('rejects malformed evidence payloads', async () => {
    const response = await POST(request({ title: 'too little' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(mockAppendEvidence).not.toHaveBeenCalled()
  })
})
