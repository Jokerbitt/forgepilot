import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/planning/planning-audit-store', () => ({
  getPlanningAuditStats: vi.fn(),
  listPlanningAuditRecords: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/planning/grok/audit', () => {
  it('returns audit records and stats', async () => {
    const { getPlanningAuditStats, listPlanningAuditRecords } = await import('@/lib/planning/planning-audit-store')
    vi.mocked(listPlanningAuditRecords).mockReturnValue([
      { id: 'a-1', createdAt: '2024-01-01', type: 'planning' },
    ] as unknown as ReturnType<typeof listPlanningAuditRecords>)
    vi.mocked(getPlanningAuditStats).mockReturnValue({ total: 1, lastRunAt: '2024-01-01' } as unknown as ReturnType<typeof getPlanningAuditStats>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/planning/grok/audit'))
    const body = await res.json() as { ok: boolean; records: unknown[]; stats: unknown }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.records).toHaveLength(1)
  })

  it('respects limit query parameter', async () => {
    const { getPlanningAuditStats, listPlanningAuditRecords } = await import('@/lib/planning/planning-audit-store')
    vi.mocked(listPlanningAuditRecords).mockReturnValue([] as ReturnType<typeof listPlanningAuditRecords>)
    vi.mocked(getPlanningAuditStats).mockReturnValue({ total: 0 } as unknown as ReturnType<typeof getPlanningAuditStats>)

    const { GET } = await import('./route')
    await GET(new Request('http://localhost/api/planning/grok/audit?limit=10'))

    expect(vi.mocked(listPlanningAuditRecords)).toHaveBeenCalledWith(10)
  })

  it('returns 500 when store throws', async () => {
    const { listPlanningAuditRecords } = await import('@/lib/planning/planning-audit-store')
    vi.mocked(listPlanningAuditRecords).mockImplementation(() => { throw new Error('Store error') })

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/planning/grok/audit'))
    expect(res.status).toBe(500)
  })
})
