/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/spawn-parallel
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Spawn mock ─────────────────────────────────────────────────────────────────

const spawnParallelDelegations = vi.fn<(a: unknown) => Promise<string[]>>()

vi.mock('@/lib/delegation-parallel', () => ({ spawnParallelDelegations }))

// ── Tests ─────────────────────────────────────────────────────────────────────

function makeRequest(id: string, body: unknown) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(`http://localhost/api/delegations/${id}/spawn-parallel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/delegations/[id]/spawn-parallel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when subTasks is missing', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001', {}), makeParams('del-001'))
    expect(res.status).toBe(400)
    expect(spawnParallelDelegations).not.toHaveBeenCalled()
  })

  it('returns 400 when subTasks array is empty', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001', { subTasks: [] }), makeParams('del-001'))
    expect(res.status).toBe(400)
    expect(spawnParallelDelegations).not.toHaveBeenCalled()
  })

  it('returns 400 when a subTask is missing goal', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', { subTasks: [{ title: 'Only title' }] }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(400)
    expect(spawnParallelDelegations).not.toHaveBeenCalled()
  })

  it('returns 201 with childIds on success', async () => {
    spawnParallelDelegations.mockResolvedValueOnce(['child-1', 'child-2'])
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', {
        subTasks: [
          { title: 'Sub A', goal: 'Do thing A' },
          { title: 'Sub B', goal: 'Do thing B' },
        ],
      }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(201)
    const body = await res.json() as { childIds: string[] }
    expect(body.childIds).toEqual(['child-1', 'child-2'])
    expect(spawnParallelDelegations).toHaveBeenCalledWith({
      parentId: 'del-001',
      subTasks: expect.arrayContaining([
        expect.objectContaining({ title: 'Sub A', goal: 'Do thing A' }),
      ]),
      riskClass: undefined,
    })
  })

  it('passes riskClass to spawn function', async () => {
    spawnParallelDelegations.mockResolvedValueOnce(['child-3'])
    const { POST } = await import('./route')
    await POST(
      makeRequest('del-001', {
        subTasks: [{ title: 'Sub C', goal: 'Do thing C' }],
        riskClass: 'B',
      }),
      makeParams('del-001'),
    )
    const callArg = spawnParallelDelegations.mock.calls[0]?.[0] as { riskClass: string }
    expect(callArg.riskClass).toBe('B')
  })

  it('returns 500 when spawn throws', async () => {
    spawnParallelDelegations.mockRejectedValueOnce(new Error('Spawn failed'))
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', { subTasks: [{ title: 'Sub D', goal: 'Do thing D' }] }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(500)
  })
})
