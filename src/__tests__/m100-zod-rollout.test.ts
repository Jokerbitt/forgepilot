/**
 * M100 — Zod Validation Rollout tests
 * Verifies that POST routes return structured 400 errors on invalid input.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── /api/agent-runs ──────────────────────────────────────────────────────────

vi.mock('@/lib/agent-runs/store', () => ({
  getRuns: vi.fn(() => []),
  createRun: vi.fn((delegationId: string, contractId: string, model: string) => ({
    id: 'run-1',
    delegationId,
    contractId,
    model,
    status: 'pending',
    createdAt: new Date().toISOString(),
  })),
}))

describe('POST /api/agent-runs — Zod validation', () => {
  const makeReq = (body: unknown) =>
    new NextRequest('http://localhost/api/agent-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('returns 400 when delegationId is missing', async () => {
    const { POST } = await import('@/app/api/agent-runs/route')
    const res = await POST(makeReq({ contractId: 'c1', model: 'gpt-4' }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string; fields: Record<string, string> }
    expect(body.error).toBe('Validation failed')
    expect(body.fields.delegationId).toBeDefined()
  })

  it('returns 400 when contractId is missing', async () => {
    const { POST } = await import('@/app/api/agent-runs/route')
    const res = await POST(makeReq({ delegationId: 'd1', model: 'gpt-4' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('@/app/api/agent-runs/route')
    const req = new NextRequest('http://localhost/api/agent-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 on valid input', async () => {
    const { POST } = await import('@/app/api/agent-runs/route')
    const res = await POST(makeReq({ delegationId: 'd1', contractId: 'c1', model: 'claude-3' }))
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; delegationId: string }
    expect(body.delegationId).toBe('d1')
  })
})

// ─── /api/settings — Zod validation ──────────────────────────────────────────

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(() => ({
    ignoreStatuses: ['done'],
    penalizeOldBacklogs: true,
    backlogPenaltyAgeDays: 90,
    backlogPenaltyScore: 20,
    showTriageJoker: true,
    maxRecommendations: 5,
    pinnedItems: [],
    customLlmModels: [],
    projects: [],
    milestones: [],
    approvalMode: 'manual',
    autopilotMinScore: 80,
    autopilotMaxRiskClass: 'A',
    aiProvider: 'anthropic',
    localCodingModel: '',
    localFastModel: '',
    maxConcurrentAgents: 2,
    autoStartApproved: false,
    autoPmAgent: false,
  })),
  saveNBAConfig: vi.fn(),
}))

describe('POST /api/settings — Zod validation', () => {
  const makeReq = (body: unknown) =>
    new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('returns 400 for unknown fields (strict schema)', async () => {
    const { POST } = await import('@/app/api/settings/route')
    const res = await POST(makeReq({ unknownField: 'value' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when maxRecommendations exceeds limit', async () => {
    const { POST } = await import('@/app/api/settings/route')
    const res = await POST(makeReq({ maxRecommendations: 999 }))
    expect(res.status).toBe(400)
    const body = await res.json() as { fields: Record<string, string> }
    expect(body.fields.maxRecommendations).toBeDefined()
  })

  it('returns 400 for invalid approvalMode', async () => {
    const { POST } = await import('@/app/api/settings/route')
    const res = await POST(makeReq({ approvalMode: 'invalid-mode' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 on valid partial update', async () => {
    const { POST } = await import('@/app/api/settings/route')
    const res = await POST(makeReq({ maxRecommendations: 10, showTriageJoker: false }))
    expect(res.status).toBe(200)
  })
})

// ─── /api/attention — Zod validation ─────────────────────────────────────────

vi.mock('@/lib/attention/engine', () => ({
  syncAttentionFromDelegations: vi.fn(),
}))

vi.mock('@/lib/attention/store', () => ({
  getOpenAttentionItems: vi.fn(() => []),
  upsertAttentionItem: vi.fn(),
}))

describe('POST /api/attention — Zod validation', () => {
  const makeReq = (body: unknown) =>
    new NextRequest('http://localhost/api/attention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('returns 400 when title is missing', async () => {
    const { POST } = await import('@/app/api/attention/route')
    const res = await POST(makeReq({ type: 'escalation' }))
    expect(res.status).toBe(400)
    const body = await res.json() as { fields: Record<string, string> }
    expect(body.fields.title).toBeDefined()
  })

  it('returns 400 when type is invalid', async () => {
    const { POST } = await import('@/app/api/attention/route')
    const res = await POST(makeReq({ title: 'Test', type: 'unknown-type' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with valid escalation item', async () => {
    const { POST } = await import('@/app/api/attention/route')
    const res = await POST(makeReq({
      type: 'escalation',
      title: 'Agent needs help',
      severity: 'warning',
    }))
    expect(res.status).toBe(201)
    const item = await res.json() as { type: string; title: string }
    expect(item.type).toBe('escalation')
    expect(item.title).toBe('Agent needs help')
  })
})

// ─── Schema completeness ──────────────────────────────────────────────────────

describe('Zod schemas', () => {
  it('NBAConfigUpdateSchema rejects values out of range', async () => {
    const { NBAConfigUpdateSchema } = await import('@/lib/validation/schemas')
    const result = NBAConfigUpdateSchema.safeParse({ maxConcurrentAgents: 99 })
    expect(result.success).toBe(false)
  })

  it('CreateAgentRunSchema requires all 3 fields', async () => {
    const { CreateAgentRunSchema } = await import('@/lib/validation/schemas')
    expect(CreateAgentRunSchema.safeParse({}).success).toBe(false)
    expect(CreateAgentRunSchema.safeParse({ delegationId: 'd', contractId: 'c', model: 'm' }).success).toBe(true)
  })

  it('AttentionItemCreateSchema enforces known AttentionTypes', async () => {
    const { AttentionItemCreateSchema } = await import('@/lib/validation/schemas')
    const bad = AttentionItemCreateSchema.safeParse({ type: 'anything', title: 'T' })
    expect(bad.success).toBe(false)
    const good = AttentionItemCreateSchema.safeParse({ type: 'escalation', title: 'Test title' })
    expect(good.success).toBe(true)
  })
})
