import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
  readFileSync: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/sprint-status', () => {
  it('returns sprint data from linear-issues.json', async () => {
    const fs = await import('fs')
    vi.mocked(fs.default.readFileSync).mockImplementation((filePath: unknown) => {
      const p = String(filePath)
      if (p.includes('linear-issues')) {
        return JSON.stringify([
          { id: 'FP-1', title: 'Done task', status: 'done' },
          { id: 'FP-2', title: 'In progress', status: 'in-progress' },
        ])
      }
      throw new Error('File not found')
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { done: number; total: number; percent: number }

    expect(res.status).toBe(200)
    expect(body.total).toBe(2)
    expect(body.done).toBe(1)
    expect(body.percent).toBe(50)
  })

  it('falls back to delegations.json when no linear data', async () => {
    const fs = await import('fs')
    vi.mocked(fs.default.readFileSync).mockImplementation((filePath: unknown) => {
      const p = String(filePath)
      if (p.includes('linear-issues')) throw new Error('Not found')
      if (p.includes('delegations')) {
        return JSON.stringify([
          { id: 'd-1', title: 'Delegation 1', status: 'completed' },
          { id: 'd-2', title: 'Delegation 2', status: 'running' },
        ])
      }
      throw new Error('File not found')
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { done: number; total: number; sprintName: string }

    expect(res.status).toBe(200)
    expect(body.sprintName).toContain('Delegations')
    expect(body.total).toBe(2)
    expect(body.done).toBe(1)
  })

  it('returns FALLBACK when no data available', async () => {
    const fs = await import('fs')
    vi.mocked(fs.default.readFileSync).mockImplementation(() => { throw new Error('Not found') })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { done: number; total: number; percent: number }

    expect(res.status).toBe(200)
    expect(body.done).toBe(0)
    expect(body.total).toBe(0)
    expect(body.percent).toBe(0)
  })
})
