import { describe, it, expect, vi } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({ GITHUB_TOKEN: 'ghp_test123' })),
}))

vi.mock('@/lib/agent-runner/pr-reviewer', () => ({
  runPRReview: vi.fn(async () => ({
    prNumber: 42,
    prTitle: 'feat: test PR',
    prUrl: 'https://github.com/owner/repo/pull/42',
    passed: true,
    findings: [],
    filesChanged: ['src/lib/feature.ts'],
    scopeViolations: [],
    issuesCreated: 0,
    reviewedAt: '2026-05-18T00:00:00.000Z',
  })),
}))

import { runPRReview } from '@/lib/agent-runner/pr-reviewer'
const mockReview = vi.mocked(runPRReview)

describe('POST /api/pr-review', () => {
  it('returns 400 for missing prNumber', async () => {
    const req = new Request('http://localhost/api/pr-review', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid prNumber', async () => {
    const req = new Request('http://localhost/api/pr-review', {
      method: 'POST',
      body: JSON.stringify({ prNumber: -1 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with review result for valid PR', async () => {
    const req = new Request('http://localhost/api/pr-review', {
      method: 'POST',
      body: JSON.stringify({ prNumber: 42 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json() as { prNumber: number; passed: boolean }
    expect(data.prNumber).toBe(42)
    expect(data.passed).toBe(true)
    expect(mockReview).toHaveBeenCalledWith(
      expect.objectContaining({ prNumber: 42, ghToken: 'ghp_test123' })
    )
  })

  it('passes delegationId and expectedScope through to reviewer', async () => {
    const req = new Request('http://localhost/api/pr-review', {
      method: 'POST',
      body: JSON.stringify({ prNumber: 99, delegationId: 'del-1', expectedScope: ['src/lib/'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)
    expect(mockReview).toHaveBeenCalledWith(
      expect.objectContaining({ prNumber: 99, delegationId: 'del-1', expectedScope: ['src/lib/'] })
    )
  })
})
