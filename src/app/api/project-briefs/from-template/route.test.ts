import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/project-briefs', () => ({
  buildProjectBrief: vi.fn(),
  saveProjectBrief: vi.fn(),
}))
vi.mock('@/lib/project-briefs/templates', () => ({
  BRIEF_TEMPLATES: [
    {
      id: 'saas',
      name: 'SaaS App',
      brief: {
        title: 'SaaS Starter',
        problemStatement: 'Need a SaaS product',
        targetUsers: 'Developers',
        successMetrics: ['10 users in first month'],
        techStack: ['Next.js', 'Supabase'],
      },
    },
  ],
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/project-briefs/from-template', () => {
  it('creates brief from template and returns redirect URL', async () => {
    const { buildProjectBrief, saveProjectBrief } = await import('@/lib/project-briefs')
    vi.mocked(buildProjectBrief).mockReturnValue({ id: 'brief-new', title: 'SaaS Starter' } as unknown as ReturnType<typeof buildProjectBrief>)
    vi.mocked(saveProjectBrief).mockReturnValue({ id: 'brief-new', title: 'SaaS Starter' } as unknown as ReturnType<typeof saveProjectBrief>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ templateId: 'saas' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { id: string; redirectUrl: string }

    expect(res.status).toBe(201)
    expect(body.id).toBe('brief-new')
    expect(body.redirectUrl).toContain('brief-new')
  })

  it('returns 400 when template not found', async () => {
    const { buildProjectBrief } = await import('@/lib/project-briefs')
    vi.mocked(buildProjectBrief).mockReturnValue({} as unknown as ReturnType<typeof buildProjectBrief>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ templateId: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when templateId is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
