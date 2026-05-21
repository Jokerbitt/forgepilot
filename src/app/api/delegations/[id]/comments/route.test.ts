import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Store mock ──────────────────────────────────────────────────────────────

const store = vi.hoisted(() => ({
  comments: [] as Array<{ id: string; delegationId: string; author: string; authorName: string; body: string; createdAt: string }>,
}))

vi.mock('@/lib/delegations/comments-store', () => ({
  getComments: vi.fn((delegationId: string) =>
    store.comments.filter(c => c.delegationId === delegationId),
  ),
  addComment: vi.fn((input: { delegationId: string; author: string; authorName: string; body: string }) => {
    const comment = {
      id: 'test-id-1',
      delegationId: input.delegationId,
      author: input.author,
      authorName: input.authorName,
      body: input.body,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    store.comments.push(comment)
    return comment
  }),
}))

import { GET, POST } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/delegations/${id}/comments`)
}

function makePostRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/delegations/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  store.comments.length = 0
  vi.clearAllMocks()
})

describe('GET /api/delegations/[id]/comments', () => {
  it('returns empty array when no comments exist', async () => {
    const res = await GET(makeGetRequest('del-1'), makeParams('del-1'))
    expect(res.status).toBe(200)
    const data = await res.json() as { comments: unknown[] }
    expect(data.comments).toEqual([])
  })

  it('returns comments for the given delegation', async () => {
    store.comments.push({
      id: 'c1',
      delegationId: 'del-1',
      author: 'user',
      authorName: 'Sven',
      body: 'Looks good',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const res = await GET(makeGetRequest('del-1'), makeParams('del-1'))
    const data = await res.json() as { comments: typeof store.comments }
    expect(data.comments).toHaveLength(1)
    expect(data.comments[0].body).toBe('Looks good')
  })
})

describe('POST /api/delegations/[id]/comments', () => {
  it('creates a comment and returns 201', async () => {
    const res = await POST(
      makePostRequest('del-2', { body: 'Testing comment', author: 'user', authorName: 'Sven' }),
      makeParams('del-2'),
    )
    expect(res.status).toBe(201)
    const data = await res.json() as { comment: { body: string; delegationId: string } }
    expect(data.comment.body).toBe('Testing comment')
    expect(data.comment.delegationId).toBe('del-2')
  })

  it('defaults author to "user" and authorName to "User"', async () => {
    const res = await POST(
      makePostRequest('del-3', { body: 'Hello' }),
      makeParams('del-3'),
    )
    expect(res.status).toBe(201)
    const data = await res.json() as { comment: { author: string; authorName: string } }
    expect(data.comment.author).toBe('user')
    expect(data.comment.authorName).toBe('User')
  })

  it('returns 400 for empty body', async () => {
    const res = await POST(
      makePostRequest('del-4', { body: '' }),
      makeParams('del-4'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing body field', async () => {
    const res = await POST(
      makePostRequest('del-5', {}),
      makeParams('del-5'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid author value', async () => {
    const res = await POST(
      makePostRequest('del-6', { body: 'Hi', author: 'admin' }),
      makeParams('del-6'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for body exceeding 4000 chars', async () => {
    const res = await POST(
      makePostRequest('del-7', { body: 'x'.repeat(4001) }),
      makeParams('del-7'),
    )
    expect(res.status).toBe(400)
  })
})
