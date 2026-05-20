import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scoreOutput } from './harness'

// ─── fs mock ──────────────────────────────────────────────────────────────────

const store = vi.hoisted(() => ({} as Record<string, string>))

vi.mock('fs', () => {
  const fsMock = {
    existsSync: (p: string) => p in store,
    readFileSync: (p: string) => {
      if (p in store) return store[p]
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
    },
    writeFileSync: (p: string, data: string) => { store[p] = data },
    renameSync: (tmp: string, dest: string) => {
      if (tmp in store) { store[dest] = store[tmp]; delete store[tmp] }
    },
    mkdirSync: vi.fn(),
  }
  return { default: fsMock, ...fsMock }
})
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => null }))

// ─── scoreOutput ───────────────────────────────────────────────────────────────

describe('scoreOutput', () => {
  it('gives grade A when all criteria are met with low token usage', () => {
    const result = scoreOutput({
      agentOutput: 'authentication middleware implemented with jwt validation and error handling complete',
      criteria: ['authentication', 'jwt validation', 'error handling'],
      tokensUsed: 1500,
      filesChangedOutsideScope: 0,
    })
    expect(result.grade).toBe('A')
    expect(result.correctnessScore).toBe(100)
    expect(result.efficiencyScore).toBe(95)
    expect(result.driftScore).toBe(100)
  })

  it('gives lower grade when no criteria are met', () => {
    const result = scoreOutput({
      agentOutput: 'hello world',
      criteria: ['authentication', 'jwt validation', 'database migration'],
      tokensUsed: 1000,
      filesChangedOutsideScope: 0,
    })
    expect(result.correctnessScore).toBe(0)
    expect(['D', 'F']).toContain(result.grade)
  })

  it('uses 75 correctness score when no criteria provided', () => {
    const result = scoreOutput({
      agentOutput: 'some output',
      criteria: [],
      tokensUsed: 1000,
      filesChangedOutsideScope: 0,
    })
    expect(result.correctnessScore).toBe(75)
  })

  it('penalizes high token usage in efficiency score', () => {
    const lowTokens = scoreOutput({
      agentOutput: 'done',
      criteria: [],
      tokensUsed: 500,
      filesChangedOutsideScope: 0,
    })
    const highTokens = scoreOutput({
      agentOutput: 'done',
      criteria: [],
      tokensUsed: 25000,
      filesChangedOutsideScope: 0,
    })
    expect(lowTokens.efficiencyScore).toBeGreaterThan(highTokens.efficiencyScore)
    expect(lowTokens.efficiencyScore).toBe(95)
    expect(highTokens.efficiencyScore).toBe(20)
  })

  it('penalizes scope drift', () => {
    const noScope = scoreOutput({
      agentOutput: 'done',
      criteria: [],
      tokensUsed: 0,
      filesChangedOutsideScope: 0,
    })
    const highScope = scoreOutput({
      agentOutput: 'done',
      criteria: [],
      tokensUsed: 0,
      filesChangedOutsideScope: 5,
    })
    expect(noScope.driftScore).toBe(100)
    expect(highScope.driftScore).toBe(20)
  })

  it('criteriaHit array matches criteria length', () => {
    const result = scoreOutput({
      agentOutput: 'authentication done and tests passed',
      criteria: ['authentication', 'missing feature', 'tests'],
      tokensUsed: 0,
    })
    expect(result.criteriaHit).toHaveLength(3)
    expect(result.criteriaHit[0]).toBe(true)  // 'authentication' found
    expect(result.criteriaHit[2]).toBe(true)  // 'tests' found
  })

  it('handles undefined tokensUsed (defaults to 80 efficiency)', () => {
    const result = scoreOutput({
      agentOutput: 'done',
      criteria: [],
    })
    expect(result.efficiencyScore).toBe(80)
  })

  it('token thresholds give correct efficiency scores', () => {
    const cases = [
      { tokens: 1500,  expected: 95 },
      { tokens: 3000,  expected: 80 },
      { tokens: 7500,  expected: 60 },
      { tokens: 15000, expected: 40 },
      { tokens: 25000, expected: 20 },
    ]
    for (const { tokens, expected } of cases) {
      const result = scoreOutput({ agentOutput: 'ok', criteria: [], tokensUsed: tokens })
      expect(result.efficiencyScore, `tokens=${tokens}`).toBe(expected)
    }
  })
})

// ─── CRUD operations ──────────────────────────────────────────────────────────

describe('eval case CRUD', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    vi.resetModules()
  })

  it('lists empty cases when no file exists', async () => {
    const { listEvalCases } = await import('./harness')
    expect(listEvalCases()).toEqual([])
  })

  it('upserts and retrieves an eval case', async () => {
    const { upsertEvalCase, getEvalCase } = await import('./harness')
    const c = upsertEvalCase({
      id: 'case-1',
      title: 'Auth flow test',
      prompt: 'Implement auth',
      acceptanceCriteria: ['login works', 'logout works'],
      tags: [],
      active: true,
    })
    expect(c.id).toBe('case-1')
    expect(c.createdAt).toBeTruthy()

    const found = getEvalCase('case-1')
    expect(found?.title).toBe('Auth flow test')
  })

  it('updates existing case on upsert', async () => {
    const { upsertEvalCase, getEvalCase } = await import('./harness')
    upsertEvalCase({ id: 'c1', title: 'Old title', prompt: 'p', acceptanceCriteria: [], tags: [], active: true })
    upsertEvalCase({ id: 'c1', title: 'New title', prompt: 'p', acceptanceCriteria: [], tags: [], active: true })
    expect(getEvalCase('c1')?.title).toBe('New title')
  })

  it('deletes an eval case', async () => {
    const { upsertEvalCase, deleteEvalCase, getEvalCase } = await import('./harness')
    upsertEvalCase({ id: 'del-me', title: 'Delete me', prompt: 'p', acceptanceCriteria: [], tags: [], active: true })
    deleteEvalCase('del-me')
    expect(getEvalCase('del-me')).toBeUndefined()
  })
})

describe('regression detection', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    vi.resetModules()
  })

  it('returns null when no prior result exists', async () => {
    const { detectRegression } = await import('./harness')
    expect(detectRegression('unknown-case', 'B')).toBeNull()
  })

  it('detects regression from A to C', async () => {
    const { saveEvalResult, detectRegression } = await import('./harness')
    await saveEvalResult({
      id: 'r1',
      caseId: 'c1',
      overallGrade: 'A',
      correctnessScore: 90,
      efficiencyScore: 95,
      driftScore: 100,
      criteriaHit: [],
      regression: false,
      evaluatedAt: new Date().toISOString(),
    })

    // detectRegression reads the same store — no module reset needed
    const alert = detectRegression('c1', 'C')
    expect(alert).not.toBeNull()
    expect(alert?.previousGrade).toBe('A')
    expect(alert?.currentGrade).toBe('C')
    expect(alert?.scoreDelta).toBe(2) // A(0) → C(2)
  })
})
