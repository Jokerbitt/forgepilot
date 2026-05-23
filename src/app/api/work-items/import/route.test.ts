import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/work-items/csv-parser', () => ({
  parseCSV: vi.fn(),
}))
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('[]'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('[]'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/work-items/import', () => {
  it('imports CSV rows and returns count', async () => {
    const { parseCSV } = await import('@/lib/work-items/csv-parser')
    vi.mocked(parseCSV).mockReturnValue([
      { title: 'Task 1', priority: 'high', description: '' },
      { title: 'Task 2', priority: 'low', description: '' },
    ] as ReturnType<typeof parseCSV>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ csv: 'title,priority\nTask 1,high\nTask 2,low' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { imported: number; items: unknown[] }

    expect(res.status).toBe(200)
    expect(body.imported).toBe(2)
    expect(body.items).toHaveLength(2)
  })

  it('returns imported=0 when CSV has no rows', async () => {
    const { parseCSV } = await import('@/lib/work-items/csv-parser')
    vi.mocked(parseCSV).mockReturnValue([])

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ csv: 'title,priority\n' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { imported: number }

    expect(res.status).toBe(200)
    expect(body.imported).toBe(0)
  })

  it('returns 400 when CSV field is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when parseCSV throws', async () => {
    const { parseCSV } = await import('@/lib/work-items/csv-parser')
    vi.mocked(parseCSV).mockImplementation(() => { throw new Error('Invalid CSV') })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ csv: 'bad data;;' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
