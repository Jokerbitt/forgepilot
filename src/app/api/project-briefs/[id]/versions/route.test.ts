import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

const mockBrief = { id: 'brief-1', title: 'Brief' }
const mockVersion = { versionId: 'v1', briefId: 'brief-1', versionNumber: 1, savedAt: '2026-01-01T00:00:00.000Z', snapshot: mockBrief }

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn((id: string) => id === 'brief-1' ? mockBrief : undefined),
}))

vi.mock('@/lib/project-briefs/brief-versions', () => ({
  getBriefVersions: vi.fn((id: string) => id === 'brief-1' ? [mockVersion] : []),
  saveSnapshot: vi.fn(() => mockVersion),
}))

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe('/api/project-briefs/[id]/versions', () => {
  it('lists versions for a brief', async () => {
    const res = await GET(new NextRequest('http://localhost'), makeParams('brief-1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ versions: [mockVersion] })
  })

  it('creates a manual snapshot', async () => {
    const { saveSnapshot } = await import('@/lib/project-briefs/brief-versions')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ label: 'Manual' }),
    })
    const res = await POST(req, makeParams('brief-1'))
    expect(res.status).toBe(201)
    expect(saveSnapshot).toHaveBeenCalledWith(mockBrief, 'Manual')
  })

  it('returns 404 when creating a snapshot for an unknown brief', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST', body: '{}' })
    const res = await POST(req, makeParams('missing'))
    expect(res.status).toBe(404)
  })
})
