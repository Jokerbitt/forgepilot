import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agents/validate', () => {
  it('returns 200 and passed=true when all checks succeed', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync)
      .mockReturnValueOnce('OK' as unknown as ReturnType<typeof execSync>)
      .mockReturnValueOnce('passed' as unknown as ReturnType<typeof execSync>)
      .mockReturnValueOnce('0' as unknown as ReturnType<typeof execSync>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/validate', {
      method: 'POST',
      body: JSON.stringify({ agentId: 'claude-code', milestone: 'M320' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const body = await res.json() as { passed: boolean; steps: { step: string; ok: boolean }[]; agentId: string }

    expect(res.status).toBe(200)
    expect(body.passed).toBe(true)
    expect(body.agentId).toBe('claude-code')
    expect(body.steps).toHaveLength(3)
  })

  it('returns 422 and passed=false when a check fails', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync)
      .mockReturnValueOnce('OK' as unknown as ReturnType<typeof execSync>)
      .mockImplementationOnce(() => {
        const err = Object.assign(new Error('test failed'), { stdout: 'FAIL', stderr: '' })
        throw err
      })
      .mockReturnValue('0' as unknown as ReturnType<typeof execSync>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/validate', {
      method: 'POST',
      body: JSON.stringify({ agentId: 'claude-code' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const body = await res.json() as { passed: boolean }
    expect(res.status).toBe(422)
    expect(body.passed).toBe(false)
  })

  it('returns 400 when body is malformed JSON', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/validate', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
