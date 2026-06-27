import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { POST } from './route'

const pendingDelegation = {
  id: 'del-approve-1',
  status: 'pending' as const,
  executionRoute: 'local-agent' as const,
  costEstimateUsd: 0.25,
  contract: {
    id: 'contract-1',
    workItemId: 'LOCAL-1',
    goal: 'Test approval',
    context: 'Context',
    definitionOfDone: ['Approved'],
    riskClass: 'A' as const,
    maxBudgetUsd: 1,
    allowedTools: ['Read'],
    branchStrategy: 'feature' as const,
    requiresApproval: true,
    privacyMode: 'local' as const,
    createdAt: '2026-05-17T00:00:00Z',
  },
  logs: [],
  createdAt: '2026-05-17T00:00:00Z',
  updatedAt: '2026-05-17T00:00:00Z',
}

const store = { data: JSON.stringify([pendingDelegation]) }

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => store.data),
    writeFileSync: vi.fn((_file: string, data: string) => { store.data = data }),
    renameSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
}))

const makeRequest = (body?: unknown) => new Request('http://localhost/api/delegations/del-approve-1/approve', {
  method: 'POST',
  body: body ? JSON.stringify(body) : undefined,
})

describe('POST /api/delegations/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.data = JSON.stringify([pendingDelegation])
  })

  it('approves a pending non-critical delegation and writes an audit log', async () => {
    const res = await POST(makeRequest({ source: 'n8n-autopilot', note: 'max batch 10' }), { params: Promise.resolve({ id: 'del-approve-1' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('approved')
    expect(data.contract.requiresApproval).toBe(false)
    expect(data.approvalId).toBeDefined()
    expect(data.logs.at(-1).message).toContain('n8n-autopilot')
    // ADR-003 P2: structured approval audit trail
    expect(data.approvedBy.actor).toBe('n8n-autopilot')
    expect(data.approvedBy.reason).toBe('max batch 10')
    expect(typeof data.approvedBy.approvedAt).toBe('string')
  })

  describe('RiskClass C approval path (ADR-004)', () => {
    const riskC = { ...pendingDelegation, contract: { ...pendingDelegation.contract, riskClass: 'C' as const } }

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('rejects Risk-C without a reason (400)', async () => {
      store.data = JSON.stringify([riskC])
      const res = await POST(makeRequest({ source: 'sven' }), { params: Promise.resolve({ id: 'del-approve-1' }) })
      expect(res.status).toBe(400)
    })

    it('rejects Risk-C from an automated actor (403)', async () => {
      vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven')
      store.data = JSON.stringify([riskC])
      const res = await POST(makeRequest({ source: 'autonomous-mode', note: 'auto' }), { params: Promise.resolve({ id: 'del-approve-1' }) })
      expect(res.status).toBe(403)
    })

    it('rejects Risk-C from a human not on the allowlist (403)', async () => {
      vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven')
      store.data = JSON.stringify([riskC])
      const res = await POST(makeRequest({ source: 'mallory', note: 'trust me' }), { params: Promise.resolve({ id: 'del-approve-1' }) })
      expect(res.status).toBe(403)
    })

    it('approves Risk-C for an allowlisted human with a reason and records the audit trail', async () => {
      vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', 'sven')
      store.data = JSON.stringify([riskC])
      const res = await POST(makeRequest({ source: 'sven', note: 'schema migration reviewed manually' }), { params: Promise.resolve({ id: 'del-approve-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('approved')
      expect(data.approvedBy.actor).toBe('sven')
      expect(data.approvedBy.reason).toBe('schema migration reviewed manually')
    })

    it('stays blocked when no allowlist is configured (fail-closed)', async () => {
      vi.stubEnv('FORGEPILOT_RISK_C_APPROVERS', '')
      store.data = JSON.stringify([riskC])
      const res = await POST(makeRequest({ source: 'sven', note: 'reason' }), { params: Promise.resolve({ id: 'del-approve-1' }) })
      expect(res.status).toBe(403)
    })
  })

  it('returns conflict for already approved delegations', async () => {
    store.data = JSON.stringify([{ ...pendingDelegation, status: 'approved' }])
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'del-approve-1' }) })
    expect(res.status).toBe(409)
  })
})
