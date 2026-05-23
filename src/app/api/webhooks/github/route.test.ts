import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/webhooks/hmac', () => ({
  verifyWebhookSignature: vi.fn(),
}))
vi.mock('@/lib/linear/client', () => ({
  createLinearClient: vi.fn(),
  extractLinearIssueIds: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/webhooks/github', () => {
  it('returns 401 when signature is invalid', async () => {
    const { verifyWebhookSignature } = await import('@/lib/webhooks/hmac')
    vi.mocked(verifyWebhookSignature).mockReturnValue(false)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ action: 'closed' }),
      headers: { 'Content-Type': 'application/json', 'x-github-event': 'pull_request', 'x-hub-signature-256': 'sha256=wrong' },
    })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('ignores non-PR events', async () => {
    const { verifyWebhookSignature } = await import('@/lib/webhooks/hmac')
    vi.mocked(verifyWebhookSignature).mockReturnValue(true)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ action: 'opened' }),
      headers: { 'Content-Type': 'application/json', 'x-github-event': 'push' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean; message: string }

    expect(res.status).toBe(200)
    expect(body.message).toContain('Ignored')
  })

  it('closes Linear issues for merged PR', async () => {
    const { verifyWebhookSignature } = await import('@/lib/webhooks/hmac')
    const { createLinearClient, extractLinearIssueIds } = await import('@/lib/linear/client')
    vi.mocked(verifyWebhookSignature).mockReturnValue(true)
    vi.mocked(extractLinearIssueIds).mockReturnValue(['FP-123'])
    vi.mocked(createLinearClient).mockReturnValue({
      closeIssue: vi.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof createLinearClient>)

    const payload = JSON.stringify({
      action: 'closed',
      pull_request: { merged: true, title: 'Fix FP-123 auth bug', body: null, merge_commit_sha: 'abc123' },
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json', 'x-github-event': 'pull_request' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean; results: { id: string; closed: boolean }[] }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].id).toBe('FP-123')
  })

  it('skips closing when no Linear issue IDs found', async () => {
    const { verifyWebhookSignature } = await import('@/lib/webhooks/hmac')
    const { extractLinearIssueIds } = await import('@/lib/linear/client')
    vi.mocked(verifyWebhookSignature).mockReturnValue(true)
    vi.mocked(extractLinearIssueIds).mockReturnValue([])

    const payload = JSON.stringify({
      action: 'closed',
      pull_request: { merged: true, title: 'Fix typo', body: null, merge_commit_sha: 'abc' },
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json', 'x-github-event': 'pull_request' },
    })
    const res = await POST(req)
    const body = await res.json() as { ok: boolean; message: string }

    expect(res.status).toBe(200)
    expect(body.message).toContain('No Linear issue IDs')
  })
})

describe('GET /api/webhooks/github', () => {
  it('returns service info', async () => {
    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
