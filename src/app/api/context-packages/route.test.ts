import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the store and builder so tests don't hit the filesystem
vi.mock('@/lib/context-packages/store', () => ({
  getPackages: vi.fn(),
  savePackage: vi.fn((pkg) => pkg),
}))

vi.mock('@/lib/context-packages/builder', () => ({
  buildContextPackage: vi.fn(),
}))

import * as store from '@/lib/context-packages/store'
import * as builder from '@/lib/context-packages/builder'
import { GET, POST } from './route'
import type { ContextPackage, BuildContextPackageResult } from '@/lib/context-packages/types'

const makePkg = (overrides: Partial<ContextPackage> = {}): ContextPackage => ({
  id: 'pkg-test-1',
  workItemId: 'LOCAL-1',
  title: 'Test Context',
  objective: 'Test objective',
  privacyMode: 'hybrid',
  sources: [],
  memoryCardIds: [],
  content: '# Context Package\nObjective: Test objective',
  tokenCount: 150,
  tokenBudget: 8000,
  readinessScore: 40,
  blockers: ['No memory cards found'],
  createdAt: '2026-05-18T10:00:00Z',
  expiresAt: '2026-05-18T14:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/context-packages', () => {
  it('returns empty array when no packages exist', async () => {
    vi.mocked(store.getPackages).mockReturnValue([])

    const req = new Request('http://localhost/api/context-packages')
    const res = await GET(req)
    const data = await res.json() as ContextPackage[]

    expect(res.status).toBe(200)
    expect(data).toEqual([])
  })

  it('returns all packages from store', async () => {
    const pkg = makePkg()
    vi.mocked(store.getPackages).mockReturnValue([pkg])

    const req = new Request('http://localhost/api/context-packages')
    const res = await GET(req)
    const data = await res.json() as ContextPackage[]

    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('pkg-test-1')
  })

  it('filters by workItemId query param', async () => {
    const req = new Request('http://localhost/api/context-packages?workItemId=LOCAL-1')
    vi.mocked(store.getPackages).mockReturnValue([makePkg()])

    await GET(req)

    expect(store.getPackages).toHaveBeenCalledWith('LOCAL-1')
  })
})

describe('POST /api/context-packages', () => {
  it('creates a package with valid body and returns 201', async () => {
    const pkg = makePkg({ tokenCount: 200 })
    const buildResult: BuildContextPackageResult = { package: pkg, warnings: [] }
    vi.mocked(builder.buildContextPackage).mockReturnValue(buildResult)

    const req = new Request('http://localhost/api/context-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workItemId: 'LOCAL-1',
        title: 'Test Context',
        objective: 'Test objective',
      }),
    })

    const res = await POST(req)
    const data = await res.json() as BuildContextPackageResult

    expect(res.status).toBe(201)
    expect(data.package.id).toBe('pkg-test-1')
    expect(data.package.workItemId).toBe('LOCAL-1')
    expect(store.savePackage).toHaveBeenCalledWith(pkg)
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('http://localhost/api/context-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Only title, no workItemId or objective' }),
    })

    const res = await POST(req)
    const data = await res.json() as { error: string }

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('returns 400 when body is empty object', async () => {
    const req = new Request('http://localhost/api/context-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
