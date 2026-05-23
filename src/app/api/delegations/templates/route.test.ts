import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/delegations/templates', () => ({
  getTemplates: vi.fn(),
  getTemplate: vi.fn(),
  templateToContract: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/delegations/templates', () => {
  it('returns all templates when no params provided', async () => {
    const { getTemplates } = await import('@/lib/delegations/templates')
    vi.mocked(getTemplates).mockReturnValue([
      { id: 'tpl-1', name: 'Code Review', category: 'engineering' },
      { id: 'tpl-2', name: 'Bug Fix', category: 'engineering' },
    ] as ReturnType<typeof getTemplates>)

    const { GET } = await import('./route')
    const res = GET(new Request('http://localhost/api/delegations/templates'))
    const body = await res.json() as unknown[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
  })

  it('returns single template with contract when id provided', async () => {
    const { getTemplate, templateToContract } = await import('@/lib/delegations/templates')
    vi.mocked(getTemplate).mockReturnValue({ id: 'tpl-1', name: 'Code Review', category: 'engineering' } as ReturnType<typeof getTemplate>)
    vi.mocked(templateToContract).mockReturnValue({ goal: 'Review the code', maxBudgetUsd: 2 } as ReturnType<typeof templateToContract>)

    const { GET } = await import('./route')
    const res = GET(new Request('http://localhost/api/delegations/templates?id=tpl-1'))
    const body = await res.json() as { template: unknown; contract: unknown }

    expect(res.status).toBe(200)
    expect(body.template).toBeTruthy()
    expect(body.contract).toBeTruthy()
  })

  it('returns 404 when template id not found', async () => {
    const { getTemplate } = await import('@/lib/delegations/templates')
    vi.mocked(getTemplate).mockReturnValue(undefined as ReturnType<typeof getTemplate>)

    const { GET } = await import('./route')
    const res = GET(new Request('http://localhost/api/delegations/templates?id=unknown'))
    expect(res.status).toBe(404)
  })
})
