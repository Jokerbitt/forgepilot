import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { parseCSV } from '@/lib/work-items/csv-parser'
import type { WorkItem } from '@/lib/models/work-item'

const store = { data: '[]' }

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => store.data),
    writeFileSync: vi.fn((_file: string, data: string) => { store.data = data }),
    renameSync: vi.fn(),
  },
}))

import { POST } from '@/app/api/work-items/import/route'

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/work-items/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('parseCSV()', () => {
  it('parses a valid CSV correctly', () => {
    const csv = [
      'title,type,priority,description',
      'Fix login bug,bug,high,OAuth redirect fails',
      'Add dashboard chart,feature,medium,Revenue chart for Q2',
      'Update README,chore,low,',
    ].join('\n')
    const result = parseCSV(csv)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ title: 'Fix login bug', type: 'bug', priority: 'high', description: 'OAuth redirect fails' })
    expect(result[1]).toEqual({ title: 'Add dashboard chart', type: 'feature', priority: 'medium', description: 'Revenue chart for Q2' })
    expect(result[2]).toMatchObject({ title: 'Update README', type: 'chore', priority: 'low' })
    expect(result[2].description).toBeUndefined()
  })

  it('applies fallbacks for missing or unrecognized columns', () => {
    const csv = ['title', 'Do something important', 'Another task'].join('\n')
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('task')
    expect(result[0].priority).toBe('medium')
  })

  it('applies fallbacks for unrecognized type and priority values', () => {
    const csv = ['title,type,priority', 'My task,unknown-type,super-urgent'].join('\n')
    const result = parseCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('task')
    expect(result[0].priority).toBe('medium')
  })

  it('skips empty lines', () => {
    const csv = ['title,type,priority', '', 'Valid task,task,low', '   ', 'Another task,bug,high', ''].join('\n')
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Valid task')
    expect(result[1].title).toBe('Another task')
  })

  it('returns empty array for CSV with only a header line', () => {
    expect(parseCSV('title,type,priority,description')).toHaveLength(0)
  })

  it('returns empty array when title column is missing', () => {
    expect(parseCSV(['type,priority', 'bug,high'].join('\n'))).toHaveLength(0)
  })

  it('handles all valid type and priority values', () => {
    const csv = ['title,type,priority', 'Task A,task,low', 'Task B,bug,medium', 'Task C,feature,high', 'Task D,chore,critical'].join('\n')
    const result = parseCSV(csv)
    expect(result[0]).toMatchObject({ type: 'task', priority: 'low' })
    expect(result[1]).toMatchObject({ type: 'bug', priority: 'medium' })
    expect(result[2]).toMatchObject({ type: 'feature', priority: 'high' })
    expect(result[3]).toMatchObject({ type: 'chore', priority: 'critical' })
  })

  it('is case-insensitive for column headers', () => {
    const csv = ['TITLE,TYPE,PRIORITY', 'Some task,Bug,High'].join('\n')
    const result = parseCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Some task')
    expect(result[0].type).toBe('bug')
    expect(result[0].priority).toBe('high')
  })
})

describe('POST /api/work-items/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.data = '[]'
  })

  it('returns 200 with imported count and items', async () => {
    const csv = ['title,type,priority', 'Fix login bug,bug,high', 'Add feature,feature,medium'].join('\n')
    const res = await POST(makeReq({ csv }))
    expect(res.status).toBe(200)
    const data = await res.json() as { imported: number; items: WorkItem[] }
    expect(data.imported).toBe(2)
    expect(data.items).toHaveLength(2)
    expect(data.items[0].title).toBe('Fix login bug')
    expect(data.items[0].source).toBe('local')
    expect(data.items[0].type).toBe('ticket')
  })

  it('persists items to the JSON store', async () => {
    await POST(makeReq({ csv: ['title,type,priority', 'Persistent task,task,low'].join('\n') }))
    const saved = JSON.parse(store.data) as WorkItem[]
    expect(saved).toHaveLength(1)
    expect(saved[0].title).toBe('Persistent task')
  })

  it('appends to existing items in the store', async () => {
    store.data = JSON.stringify([{
      id: 'existing-1', title: 'Existing item', source: 'local', type: 'ticket',
      status: 'todo', priority: 2, blocked: false, risk: 'A', aiDelegable: true,
      url: '', projectId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }])
    await POST(makeReq({ csv: ['title', 'New task'].join('\n') }))
    const saved = JSON.parse(store.data) as WorkItem[]
    expect(saved).toHaveLength(2)
    expect(saved[0].id).toBe('existing-1')
    expect(saved[1].title).toBe('New task')
  })

  it('returns 400 when csv field is missing', async () => {
    const res = await POST(makeReq({ foo: 'bar' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(new NextRequest('http://localhost/api/work-items/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with imported:0 for empty CSV (header only)', async () => {
    const res = await POST(makeReq({ csv: 'title,type,priority' }))
    expect(res.status).toBe(200)
    const data = await res.json() as { imported: number; items: WorkItem[] }
    expect(data.imported).toBe(0)
    expect(data.items).toHaveLength(0)
  })

  it('maps priority values correctly', async () => {
    const csv = ['title,priority', 'Critical task,critical', 'High task,high', 'Medium task,medium', 'Low task,low'].join('\n')
    const res = await POST(makeReq({ csv }))
    const data = await res.json() as { imported: number; items: WorkItem[] }
    expect(data.items[0].priority).toBe(0)
    expect(data.items[1].priority).toBe(1)
    expect(data.items[2].priority).toBe(2)
    expect(data.items[3].priority).toBe(3)
  })
})
