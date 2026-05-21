import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from './route'

const store = new Map<string, string>()
const writes: Array<{ file: string; data: string }> = []

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((file: string) => store.has(file)),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn((file: string) => store.get(file) ?? '[]'),
    writeFileSync: vi.fn((file: string, data: string) => {
      store.set(file, data)
      writes.push({ file, data })
    }),
    renameSync: vi.fn((from: string, to: string) => {
      store.set(to, store.get(from) ?? '[]')
      store.delete(from)
    }),
  },
}))

function makeRequest(body: unknown, id = 'item-1') {
  return new NextRequest(`http://localhost/api/work-items/${id}/priority`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  store.clear()
  writes.length = 0
  vi.clearAllMocks()
})

describe('PATCH /api/work-items/[id]/priority', () => {
  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/work-items/item-1/priority', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad-json',
    })

    const res = await PATCH(req, makeParams('item-1'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid JSON' })
  })

  it('returns 400 for invalid priority values', async () => {
    const res = await PATCH(makeRequest({ priority: 9 }), makeParams('item-1'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Validation failed' })
  })

  it('updates local-items.json when the work item is local', async () => {
    const localFile = `${process.cwd()}/config/local-items.json`
    store.set(localFile, JSON.stringify([{
      id: 'local-1',
      source: 'local',
      type: 'ticket',
      title: 'Local item',
      url: '',
      projectId: '',
      status: 'todo',
      priority: 2,
      blocked: false,
      risk: 'A',
      aiDelegable: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }]))

    const res = await PATCH(makeRequest({ priority: 0 }, 'local-1'), makeParams('local-1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'local-1', priority: 0 })

    const saved = JSON.parse(store.get(localFile) ?? '[]') as Array<{ id: string; priority: number }>
    expect(saved[0]).toMatchObject({ id: 'local-1', priority: 0 })
  })

  it('stores an override when the work item comes from an external connector', async () => {
    const res = await PATCH(makeRequest({ priority: 1 }, 'LIN-123'), makeParams('LIN-123'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'LIN-123', priority: 1 })

    const overrideWrite = writes.find(write => write.file.includes('work-item-priority-overrides.json.tmp'))
    expect(overrideWrite?.data).toContain('LIN-123')
    expect(overrideWrite?.data).toContain('"priority": 1')
  })
})
