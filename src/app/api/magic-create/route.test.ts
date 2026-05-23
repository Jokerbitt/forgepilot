import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(),
}))
vi.mock('@/lib/nba-engine/approval-policy', () => ({
  shouldRequireApproval: vi.fn(),
}))
vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(),
  SINGLE_TENANT_USER_ID: 'default',
}))
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('[]'),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('[]'),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/magic-create', () => {
  it('creates a work item in magic mode', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValue({ approvalMode: 'manual', aiProvider: 'anthropic' } as ReturnType<typeof getNBAConfig>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ mode: 'magic', prompt: 'Add dark mode support to the settings page' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { success: boolean; item: { title: string } }

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.item).toBeDefined()
  })

  it('creates a manual ticket', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValue({ approvalMode: 'manual', aiProvider: 'anthropic' } as ReturnType<typeof getNBAConfig>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ mode: 'manual', title: 'Fix login button', description: 'Button not working', riskClass: 'A' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { success: boolean; item: { title: string } }

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 400 when mode is missing', async () => {
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
