import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { GET, POST, DELETE } from './route'

// Mock fs module
vi.mock('fs')
vi.mock('path')

const mockWorkItems = [
  {
    id: 'item-1',
    source: 'local' as const,
    type: 'ticket' as const,
    title: 'Item 1',
    url: 'http://example.com/1',
    projectId: 'proj-1',
    status: 'todo' as const,
    priority: 2 as const,
    blocked: false,
    blockedBy: undefined,
    risk: 'C' as const,
    aiDelegable: true,
    updatedAt: '2026-05-20T00:00:00Z',
    createdAt: '2026-05-20T00:00:00Z',
  },
  {
    id: 'item-2',
    source: 'local' as const,
    type: 'ticket' as const,
    title: 'Item 2',
    url: 'http://example.com/2',
    projectId: 'proj-1',
    status: 'todo' as const,
    priority: 2 as const,
    blocked: false,
    blockedBy: undefined,
    risk: 'C' as const,
    aiDelegable: true,
    updatedAt: '2026-05-20T00:00:00Z',
    createdAt: '2026-05-20T00:00:00Z',
  },
  {
    id: 'item-3',
    source: 'local' as const,
    type: 'ticket' as const,
    title: 'Item 3',
    url: 'http://example.com/3',
    projectId: 'proj-1',
    status: 'todo' as const,
    priority: 2 as const,
    blocked: false,
    blockedBy: undefined,
    risk: 'C' as const,
    aiDelegable: true,
    updatedAt: '2026-05-20T00:00:00Z',
    createdAt: '2026-05-20T00:00:00Z',
  },
]

describe('/api/work-items/[id]/dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return dependencies for an existing work item', async () => {
      const items = JSON.parse(JSON.stringify(mockWorkItems))
      items[1].blockedBy = ['item-1']
      items[1].blocked = true

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(items))

      const req = new Request('http://localhost/api/work-items/item-2/dependencies')
      const response = await GET(req as any, { params: Promise.resolve({ id: 'item-2' }) })
      const data = await response.json() as { id: string; blockedBy: string[]; blocks: string[] }

      expect(response.status).toBe(200)
      expect(data.id).toBe('item-2')
      expect(data.blockedBy).toContain('item-1')
      expect(data.blocks).toEqual([])
    })

    it('should return 404 for non-existent work item', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkItems))

      const req = new Request('http://localhost/api/work-items/nonexistent/dependencies')
      const response = await GET(req as any, { params: Promise.resolve({ id: 'nonexistent' }) })

      expect(response.status).toBe(404)
    })

    it('should list items blocked by the requested item', async () => {
      const items = JSON.parse(JSON.stringify(mockWorkItems))
      items[1].blockedBy = ['item-1']
      items[1].blocked = true
      items[2].blockedBy = ['item-1']
      items[2].blocked = true

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(items))

      const req = new Request('http://localhost/api/work-items/item-1/dependencies')
      const response = await GET(req as any, { params: Promise.resolve({ id: 'item-1' }) })
      const data = await response.json() as { id: string; blockedBy: string[]; blocks: string[] }

      expect(response.status).toBe(200)
      expect(data.blocks).toEqual(['item-2', 'item-3'])
    })
  })

  describe('POST', () => {
    it('should set blockedBy dependencies', async () => {
      const items = JSON.parse(JSON.stringify(mockWorkItems))

      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(items))
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const body = JSON.stringify({ blockedBy: ['item-1'] })
      const req = new Request('http://localhost/api/work-items/item-2/dependencies', {
        method: 'POST',
        body,
      })

      const response = await POST(req as any, { params: Promise.resolve({ id: 'item-2' }) })
      const data = await response.json() as { id: string; blockedBy: string[] }

      expect(response.status).toBe(200)
      expect(data.blockedBy).toContain('item-1')
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled()
    })

    it('should reject circular dependencies', async () => {
      const items = JSON.parse(JSON.stringify(mockWorkItems))
      items[0].blockedBy = ['item-2']
      items[0].blocked = true

      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(items))

      const body = JSON.stringify({ blockedBy: ['item-1'] })
      const req = new Request('http://localhost/api/work-items/item-2/dependencies', {
        method: 'POST',
        body,
      })

      const response = await POST(req as any, { params: Promise.resolve({ id: 'item-2' }) })

      expect(response.status).toBe(400)
      const data = await response.json() as { error: string }
      expect(data.error).toContain('circular')
    })

    it('should reject self-blocking', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkItems))

      const body = JSON.stringify({ blockedBy: ['item-1'] })
      const req = new Request('http://localhost/api/work-items/item-1/dependencies', {
        method: 'POST',
        body,
      })

      const response = await POST(req as any, { params: Promise.resolve({ id: 'item-1' }) })

      expect(response.status).toBe(400)
      const data = await response.json() as { error: string }
      expect(data.error).toContain('cannot be blocked by itself')
    })
  })

  describe('DELETE', () => {
    it('should remove a blocker', async () => {
      const items = JSON.parse(JSON.stringify(mockWorkItems))
      items[1].blockedBy = ['item-1']
      items[1].blocked = true

      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(items))
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const body = JSON.stringify({ blockerId: 'item-1' })
      const req = new Request('http://localhost/api/work-items/item-2/dependencies', {
        method: 'DELETE',
        body,
      })

      const response = await DELETE(req as any, { params: Promise.resolve({ id: 'item-2' }) })
      const data = await response.json() as { id: string; blockedBy: string[] }

      expect(response.status).toBe(200)
      expect(data.blockedBy).not.toContain('item-1')
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled()
    })

    it('should return 404 for non-existent blocker', async () => {
      const items = JSON.parse(JSON.stringify(mockWorkItems))
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(items))

      const body = JSON.stringify({ blockerId: 'item-1' })
      const req = new Request('http://localhost/api/work-items/item-2/dependencies', {
        method: 'DELETE',
        body,
      })

      const response = await DELETE(req as any, { params: Promise.resolve({ id: 'item-2' }) })

      expect(response.status).toBe(404)
    })
  })
})
