import { describe, it, expect } from 'vitest'
import { parseLinearWebhook, verifyLinearSignature } from './webhook-parser'
import type { LinearWebhookPayload } from './webhook-parser'
import crypto from 'crypto'

function makePayload(overrides: Partial<LinearWebhookPayload> = {}): LinearWebhookPayload {
  return {
    action: 'update', type: 'Issue', organizationId: 'org-1', webhookTimestamp: Date.now(),
    data: {
      id: 'issue-1', identifier: 'JOK-42', title: 'Implement user authentication',
      description: 'Add JWT-based auth to the API', priority: 2,
      state: { id: 'state-1', name: 'In Progress', type: 'started' },
      labels: [], url: 'https://linear.app/jok/issue/JOK-42',
    },
    updatedFrom: { state: { id: 'state-0', name: 'Backlog', type: 'backlog' } },
    ...overrides,
  }
}

describe('parseLinearWebhook', () => {
  it('creates delegation when issue moves to In Progress', () => {
    const result = parseLinearWebhook(makePayload())
    expect(result.action).toBe('create-delegation')
    if (result.action !== 'create-delegation') return
    expect(result.candidate.workItemId).toBe('JOK-42')
    expect(result.candidate.linearUrl).toBe('https://linear.app/jok/issue/JOK-42')
  })
  it('ignores non-Issue webhook types', () => {
    expect(parseLinearWebhook(makePayload({ type: 'Comment' })).action).toBe('ignore')
  })
  it('ignores create and remove actions', () => {
    expect(parseLinearWebhook(makePayload({ action: 'create' })).action).toBe('ignore')
    expect(parseLinearWebhook(makePayload({ action: 'remove' })).action).toBe('ignore')
  })
  it('ignores when current state is not started', () => {
    const p = makePayload(); p.data.state = { id: 's', name: 'Done', type: 'completed' }
    expect(parseLinearWebhook(p).action).toBe('ignore')
  })
  it('ignores when already in progress (no transition)', () => {
    const p = makePayload(); p.updatedFrom = { state: { id: 's', name: 'In Review', type: 'started' } }
    expect(parseLinearWebhook(p).action).toBe('ignore')
  })
  it('sets riskClass C for urgent', () => {
    const p = makePayload(); p.data.priority = 1
    const r = parseLinearWebhook(p)
    if (r.action !== 'create-delegation') return
    expect(r.candidate.riskClass).toBe('C')
    expect(r.candidate.requiresApproval).toBe(true)
  })
  it('sets riskClass B for high priority', () => {
    const r = parseLinearWebhook(makePayload())
    if (r.action !== 'create-delegation') return
    expect(r.candidate.riskClass).toBe('B')
  })
  it('detects fix branch strategy', () => {
    const p = makePayload(); p.data.title = 'Fix crash on login'
    const r = parseLinearWebhook(p)
    if (r.action !== 'create-delegation') return
    expect(r.candidate.branchStrategy).toBe('fix')
  })
  it('detects chore branch strategy', () => {
    const p = makePayload(); p.data.title = 'Refactor auth module'
    const r = parseLinearWebhook(p)
    if (r.action !== 'create-delegation') return
    expect(r.candidate.branchStrategy).toBe('chore')
  })
  it('defaults to feature branch strategy', () => {
    const p = makePayload(); p.data.title = 'Add dark mode'
    const r = parseLinearWebhook(p)
    if (r.action !== 'create-delegation') return
    expect(r.candidate.branchStrategy).toBe('feature')
  })
  it('includes description in goal', () => {
    const r = parseLinearWebhook(makePayload())
    if (r.action !== 'create-delegation') return
    expect(r.candidate.goal).toContain('Add JWT-based auth')
  })
  it('truncates long descriptions', () => {
    const p = makePayload(); p.data.description = 'x'.repeat(600)
    const r = parseLinearWebhook(p)
    if (r.action !== 'create-delegation') return
    expect(r.candidate.goal).toContain('…')
  })
  it('handles missing updatedFrom', () => {
    const p = makePayload(); delete p.updatedFrom
    expect(parseLinearWebhook(p).action).toBe('create-delegation')
  })
  it('passes labels through', () => {
    const p = makePayload(); p.data.labels = [{ id: 'l1', name: 'auto-delegate' }]
    const r = parseLinearWebhook(p)
    if (r.action !== 'create-delegation') return
    expect(r.candidate.labels).toEqual(['auto-delegate'])
  })
  it('maps priority to budget', () => {
    const cases: [number, number][] = [[1,5],[2,3],[3,2],[0,1]]
    for (const [prio, budget] of cases) {
      const p = makePayload(); p.data.priority = prio
      const r = parseLinearWebhook(p)
      if (r.action !== 'create-delegation') continue
      expect(r.candidate.maxBudgetUsd).toBe(budget)
    }
  })
})

describe('verifyLinearSignature', () => {
  const secret = 'test-secret'
  const body = '{"action":"update"}'
  const sign = (b: string, s: string) => crypto.createHmac('sha256', s).update(b,'utf8').digest('hex')

  it('accepts valid signature', () => { expect(verifyLinearSignature(body, sign(body, secret), secret)).toBe(true) })
  it('rejects invalid signature', () => { expect(verifyLinearSignature(body, 'wrong', secret)).toBe(false) })
  it('rejects null signature when secret set', () => { expect(verifyLinearSignature(body, null, secret)).toBe(false) })
  it('allows all when no secret (dev mode)', () => { expect(verifyLinearSignature(body, null, undefined)).toBe(true) })
  it('rejects wrong-length signature', () => { expect(verifyLinearSignature(body, 'abc', secret)).toBe(false) })
})
