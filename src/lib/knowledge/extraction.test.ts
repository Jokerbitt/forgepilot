import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ─── fs mock (knowledge store writes to config/knowledge-store.json) ──────────

const store = vi.hoisted(() => ({} as Record<string, string>))

vi.mock('fs', () => {
  const fsMock = {
    existsSync:    (p: string) => p in store,
    readFileSync:  (p: string) => {
      if (p in store) return store[p]
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
    },
    writeFileSync: (p: string, data: string) => { store[p] = data },
    renameSync:    (tmp: string, dest: string) => {
      if (tmp in store) { store[dest] = store[tmp]; delete store[tmp] }
    },
    mkdirSync: vi.fn(),
  }
  return { default: fsMock, ...fsMock }
})

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id:            'del-001',
    title:         'Implement auth middleware',
    status:        'completed',
    executionRoute: 'runner',
    costEstimateUsd: 0.05,
    createdAt:     '2026-01-01T00:00:00Z',
    updatedAt:     '2026-01-01T01:00:00Z',
    contract: {
      id:               'c-001',
      workItemId:       'wi-001',
      goal:             'Add JWT auth middleware to all API routes',
      context:          '',
      definitionOfDone: ['Tests pass', 'No lint errors'],
      riskClass:        'A',
      maxBudgetUsd:     1,
      allowedTools:     ['read', 'write'],
      branchStrategy:   'feature',
      requiresApproval: false,
      privacyMode:      'private-cloud',
      skillCategory:    'api-route',
      createdAt:        '2026-01-01T00:00:00Z',
    },
    summaryReport: {
      keyPoints: ['JWT validation implemented', 'All routes secured'],
      changes: [],
      timeTakenMinutes: 12,
      filesAdded: ['src/middleware/auth.ts'],
      filesModified: ['src/app/api/delegations/route.ts'],
      testsPassed: 8,
      prUrl: 'https://github.com/org/repo/pull/42',
    },
    ...overrides,
  }
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('extractKnowledge', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    vi.resetModules()
  })

  it('returns null for non-completed delegations', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ status: 'running' })
    expect(extractKnowledge(delegation)).toBeNull()
  })

  it('returns null for failed delegations', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ status: 'failed' })
    expect(extractKnowledge(delegation)).toBeNull()
  })

  it('returns card with saved=true for completed delegation', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result).not.toBeNull()
    expect(result?.saved).toBe(true)
    expect(result?.card.id).toBe('extraction:del-001')
  })

  it('card id is deterministic: extraction:<delegationId>', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ id: 'my-custom-id' })
    const result = extractKnowledge(delegation)
    expect(result?.card.id).toBe('extraction:my-custom-id')
  })

  it('card title matches delegation title', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ title: 'My Task' })
    const result = extractKnowledge(delegation)
    expect(result?.card.title).toBe('My Task')
  })

  it('uses goal as title when delegation has no title', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ title: '' })
    const result = extractKnowledge(delegation)
    expect(result?.card.title).toContain('JWT auth middleware')
  })

  it('classifies api-route skill as learning', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.type).toBe('learning')
  })

  it('classifies test skill as pattern', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      contract: { ...makeDelegation().contract, skillCategory: 'test' },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.type).toBe('pattern')
  })

  it('classifies infrastructure skill as decision', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      contract: { ...makeDelegation().contract, skillCategory: 'infrastructure' },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.type).toBe('decision')
  })

  it('classifies high risk class as risk', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      contract: { ...makeDelegation().contract, riskClass: 'C' },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.type).toBe('risk')
  })

  it('classifies delegation with warnings as risk', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      summaryReport: { ...makeDelegation().summaryReport!, warnings: ['lint error in file.ts'] },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.type).toBe('risk')
  })

  it('card body contains key points', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.body).toContain('JWT validation implemented')
    expect(result?.card.body).toContain('All routes secured')
  })

  it('card body contains PR url when present', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.body).toContain('https://github.com/org/repo/pull/42')
  })

  it('card body contains files summary', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.body).toContain('src/middleware/auth.ts')
  })

  it('card body fallback when no report', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ summaryReport: undefined })
    const result = extractKnowledge(delegation)
    expect(result?.card.body).toContain('Delegation completed')
  })

  it('card tags include delegation:<id>', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.tags).toContain('delegation:del-001')
  })

  it('card tags include auto-extracted and outcome:completed', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.tags).toContain('auto-extracted')
    expect(result?.card.tags).toContain('outcome:completed')
  })

  it('card tags include skill category', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.tags).toContain('skill:api-route')
  })

  it('card tags include execution route', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.tags).toContain('route:runner')
  })

  it('card tags include brief when briefId is set', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ briefId: 'brief-99' })
    const result = extractKnowledge(delegation)
    expect(result?.card.tags).toContain('brief:brief-99')
  })

  it('projectId matches briefId', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ briefId: 'brief-55' })
    const result = extractKnowledge(delegation)
    expect(result?.card.projectId).toBe('brief-55')
  })

  it('confidence is high when tests pass + key points + no warnings', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.confidence).toBe('high')
  })

  it('confidence is medium when key points but no tests', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      summaryReport: {
        keyPoints: ['Something done'],
        changes: [],
        timeTakenMinutes: 5,
        testsPassed: 0,
      },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.confidence).toBe('medium')
  })

  it('confidence is low when no report', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ summaryReport: undefined })
    const result = extractKnowledge(delegation)
    expect(result?.card.confidence).toBe('low')
  })

  it('privacyClass is local-only for local privacyMode', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      contract: { ...makeDelegation().contract, privacyMode: 'local' },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.privacyClass).toBe('local-only')
  })

  it('privacyClass is internal for private-cloud privacyMode', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation()
    const result = extractKnowledge(delegation)
    expect(result?.card.privacyClass).toBe('internal')
  })

  it('scrubs PII and secrets from extracted card body', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      summaryReport: {
        ...makeDelegation().summaryReport!,
        keyPoints: [
          'Contact admin@example.com before deploy',
          'Rotate sk-proj-abcdefghijklmnopqrstuvwxyz1234567890SECRET',
        ],
        warnings: ['Runner endpoint is 192.168.0.136'],
      },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.body).toContain('[EMAIL_REDACTED]')
    expect(result?.card.body).toContain('[API_KEY_REDACTED]')
    expect(result?.card.body).toContain('[IP_REDACTED]')
    expect(result?.card.body).not.toContain('admin@example.com')
    expect(result?.card.body).not.toContain('sk-proj-abcdefghijklmnopqrstuvwxyz1234567890SECRET')
    expect(result?.card.body).not.toContain('192.168.0.136')
  })

  it('scrubs PII from extracted card title', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({ title: 'Fix login for admin@example.com' })
    const result = extractKnowledge(delegation)
    expect(result?.card.title).toBe('Fix login for [EMAIL_REDACTED]')
  })

  it('marks cloud memory cards sensitive when PII was redacted', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      summaryReport: {
        ...makeDelegation().summaryReport!,
        keyPoints: ['User email admin@example.com was present in logs'],
      },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.privacyClass).toBe('sensitive')
    expect(result?.card.tags).toContain('pii-redacted')
    expect(result?.card.tags).toContain('pii:email')
  })

  it('keeps local memory cards local-only even when PII was redacted', async () => {
    const { extractKnowledge } = await import('./extraction')
    const delegation = makeDelegation({
      contract: { ...makeDelegation().contract, privacyMode: 'local' },
      summaryReport: {
        ...makeDelegation().summaryReport!,
        keyPoints: ['Local note contained admin@example.com'],
      },
    })
    const result = extractKnowledge(delegation)
    expect(result?.card.privacyClass).toBe('local-only')
    expect(result?.card.tags).toContain('pii-redacted')
  })

  it('persists card to knowledge store (idempotent upsert)', async () => {
    const { extractKnowledge } = await import('./extraction')
    const { getCard } = await import('./store')
    const delegation = makeDelegation()
    extractKnowledge(delegation)
    const saved = getCard('extraction:del-001')
    expect(saved).toBeDefined()
    expect(saved?.title).toBe('Implement auth middleware')
  })

  it('second extract overwrites first (upsert semantics)', async () => {
    const { extractKnowledge } = await import('./extraction')
    const { getCard } = await import('./store')
    const delegation = makeDelegation()
    extractKnowledge(delegation)
    // Mutate title and extract again — simulates re-run after report update
    const updated = { ...delegation, title: 'Updated title' }
    extractKnowledge(updated)
    const saved = getCard('extraction:del-001')
    expect(saved?.title).toBe('Updated title')
  })
})
