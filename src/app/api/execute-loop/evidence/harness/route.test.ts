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

import { POST } from './route'

function request(body: unknown): Request {
  return new Request('http://localhost/api/execute-loop/evidence/harness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/execute-loop/evidence/harness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(null)
    mockReadEvidence.mockReturnValue([])
  })

  it('returns five dry-run scenarios without recording when record=false', async () => {
    const response = await POST(request({ record: false }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.recorded).toBe(false)
    expect(body.dryRunCount).toBe(5)
    expect(body.warning).toContain('do not prove')
    expect(body.runs.every((run: { source: string }) => run.source === 'harness-dry-run')).toBe(true)
    expect(mockAppendEvidence).not.toHaveBeenCalled()
  })

  it('records five dry-run scenarios with honest warning', async () => {
    const response = await POST(request({ record: true }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.recorded).toBe(true)
    expect(body.dryRunCount).toBe(5)
    expect(mockAppendEvidence).toHaveBeenCalledTimes(5)
    expect(mockAppendEvidence).toHaveBeenCalledWith(expect.objectContaining({
      id: 'harness-settings-provider-test',
      source: 'harness-dry-run',
    }))
  })
})
