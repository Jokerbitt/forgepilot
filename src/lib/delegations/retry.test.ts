import { describe, it, expect } from 'vitest'
import type { Delegation } from '../models/delegation'
import {
  countRetries,
  detectFailureCause,
  computeBackoffMs,
  buildImprovedContext,
  buildRetryPlan,
} from './retry'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id:             'del-001',
    title:          'Implement auth',
    status:         'failed',
    executionRoute: 'runner',
    costEstimateUsd: 0.1,
    errorMessage:   undefined,
    failureFeedback: undefined,
    logs:           [],
    createdAt:      '2026-01-01T00:00:00Z',
    updatedAt:      '2026-01-01T01:00:00Z',
    contract: {
      id:               'c-001',
      workItemId:       'wi-001',
      goal:             'Add JWT auth middleware',
      context:          'This is the base context.',
      definitionOfDone: ['Tests pass'],
      riskClass:        'A',
      maxBudgetUsd:     1,
      allowedTools:     ['read', 'write'],
      branchStrategy:   'feature',
      requiresApproval: false,
      privacyMode:      'private-cloud',
      createdAt:        '2026-01-01T00:00:00Z',
    },
    ...overrides,
  }
}

function addRetryLog(delegation: Delegation, count = 1): Delegation {
  const logs = [...(delegation.logs ?? [])]
  for (let i = 0; i < count; i++) {
    logs.push({ timestamp: '2026-01-01T00:00:00Z', type: 'info', message: '🔁 Erneut eingereicht (Retry)' })
  }
  return { ...delegation, logs }
}

// ─── countRetries ─────────────────────────────────────────────────────────────

describe('countRetries', () => {
  it('returns 0 when no logs', () => {
    expect(countRetries(makeDelegation({ logs: [] }))).toBe(0)
  })

  it('counts retry log entries', () => {
    const delegation = addRetryLog(makeDelegation(), 2)
    expect(countRetries(delegation)).toBe(2)
  })

  it('counts entries containing "Retry" in message', () => {
    const delegation = makeDelegation({
      logs: [
        { timestamp: '2026-01-01T00:00:00Z', type: 'info', message: 'Retry #1 started' },
        { timestamp: '2026-01-01T00:00:00Z', type: 'info', message: 'normal log entry' },
      ],
    })
    expect(countRetries(delegation)).toBe(1)
  })
})

// ─── detectFailureCause ───────────────────────────────────────────────────────

describe('detectFailureCause', () => {
  it('detects type-error from errorMessage', () => {
    const d = makeDelegation({ errorMessage: 'TypeScript type error TS2345 in auth.ts' })
    expect(detectFailureCause(d)).toBe('type-error')
  })

  it('detects type-error from ts( in errorMessage', () => {
    const d = makeDelegation({ errorMessage: 'ts(2304): Cannot find name' })
    expect(detectFailureCause(d)).toBe('type-error')
  })

  it('detects lint-error from eslint', () => {
    const d = makeDelegation({ errorMessage: 'ESLint: 3 problems found' })
    expect(detectFailureCause(d)).toBe('lint-error')
  })

  it('detects test-failure from test + fail combination', () => {
    const d = makeDelegation({ errorMessage: 'test suite: 2 tests failed' })
    expect(detectFailureCause(d)).toBe('test-failure')
  })

  it('detects test-failure from test + expect', () => {
    const d = makeDelegation({
      logs: [{ timestamp: '', type: 'error', message: 'test: expect(received).toBe(expected) — assertion failed' }],
    })
    expect(detectFailureCause(d)).toBe('test-failure')
  })

  it('detects timeout', () => {
    const d = makeDelegation({ errorMessage: 'Process timed out after 120s' })
    expect(detectFailureCause(d)).toBe('timeout')
  })

  it('detects context-too-large', () => {
    const d = makeDelegation({ errorMessage: 'context window exceeded, token limit reached' })
    expect(detectFailureCause(d)).toBe('context-too-large')
  })

  it('detects missing-dependency from ENOENT', () => {
    const d = makeDelegation({ errorMessage: 'ENOENT: no such file or directory' })
    expect(detectFailureCause(d)).toBe('missing-dependency')
  })

  it('detects missing-dependency from cannot find module', () => {
    const d = makeDelegation({ errorMessage: 'Cannot find module \'@/lib/utils\'' })
    expect(detectFailureCause(d)).toBe('missing-dependency')
  })

  it('detects unclear-requirements from ambiguous', () => {
    const d = makeDelegation({ failureFeedback: 'The task is ambiguous — what exactly should the endpoint do?' })
    expect(detectFailureCause(d)).toBe('unclear-requirements')
  })

  it('detects budget-exceeded', () => {
    const d = makeDelegation({ errorMessage: 'Budget exceeded: cost $2.50 > max $1.00' })
    expect(detectFailureCause(d)).toBe('budget-exceeded')
  })

  it('returns unknown when no pattern matches', () => {
    const d = makeDelegation({ errorMessage: 'Something unexpected happened' })
    expect(detectFailureCause(d)).toBe('unknown')
  })

  it('checks logs in addition to errorMessage', () => {
    const d = makeDelegation({
      logs: [{ timestamp: '', type: 'error', message: 'ESLint: no-unused-vars violation' }],
    })
    expect(detectFailureCause(d)).toBe('lint-error')
  })

  it('checks failureFeedback in addition to errorMessage', () => {
    const d = makeDelegation({ failureFeedback: 'TypeScript compilation failed with 3 errors' })
    expect(detectFailureCause(d)).toBe('type-error')
  })
})

// ─── computeBackoffMs ─────────────────────────────────────────────────────────

describe('computeBackoffMs', () => {
  it('retry 0 → 5000 ms', () => {
    expect(computeBackoffMs(0)).toBe(5_000)
  })

  it('retry 1 → 10000 ms', () => {
    expect(computeBackoffMs(1)).toBe(10_000)
  })

  it('retry 2 → 20000 ms', () => {
    expect(computeBackoffMs(2)).toBe(20_000)
  })

  it('increases exponentially', () => {
    const b0 = computeBackoffMs(0)
    const b1 = computeBackoffMs(1)
    const b2 = computeBackoffMs(2)
    expect(b1).toBe(b0 * 2)
    expect(b2).toBe(b1 * 2)
  })
})

// ─── buildImprovedContext ────────────────────────────────────────────────────

describe('buildImprovedContext', () => {
  it('prepends base context when present', () => {
    const d = makeDelegation()
    const ctx = buildImprovedContext('type-error', d)
    expect(ctx).toContain('This is the base context.')
  })

  it('includes type-error guidance for type-error cause', () => {
    const ctx = buildImprovedContext('type-error', makeDelegation())
    expect(ctx).toContain('TypeScript errors')
    expect(ctx).toContain('tsc --noEmit')
  })

  it('includes lint-error guidance', () => {
    const ctx = buildImprovedContext('lint-error', makeDelegation())
    expect(ctx).toContain('ESLint')
    expect(ctx).toContain('npm run lint')
  })

  it('includes test-failure guidance', () => {
    const ctx = buildImprovedContext('test-failure', makeDelegation())
    expect(ctx).toContain('npm run test:run')
  })

  it('includes timeout guidance', () => {
    const ctx = buildImprovedContext('timeout', makeDelegation())
    expect(ctx).toContain('smaller')
  })

  it('includes context-too-large guidance', () => {
    const ctx = buildImprovedContext('context-too-large', makeDelegation())
    expect(ctx).toContain('context window')
  })

  it('includes missing-dependency guidance', () => {
    const ctx = buildImprovedContext('missing-dependency', makeDelegation())
    expect(ctx).toContain('npm install')
  })

  it('includes unclear-requirements guidance', () => {
    const ctx = buildImprovedContext('unclear-requirements', makeDelegation())
    expect(ctx).toContain('Definition of Done')
  })

  it('includes budget-exceeded guidance', () => {
    const ctx = buildImprovedContext('budget-exceeded', makeDelegation())
    expect(ctx).toContain('acceptance criteria')
  })

  it('appends previous error when errorMessage is set', () => {
    const d = makeDelegation({ errorMessage: 'Something broke here' })
    const ctx = buildImprovedContext('unknown', d)
    expect(ctx).toContain('Something broke here')
  })

  it('truncates very long errorMessage to 300 chars', () => {
    const longError = 'x'.repeat(500)
    const d = makeDelegation({ errorMessage: longError })
    const ctx = buildImprovedContext('unknown', d)
    expect(ctx).not.toContain(longError)
    expect(ctx).toContain('x'.repeat(300))
  })
})

// ─── buildRetryPlan ───────────────────────────────────────────────────────────

describe('buildRetryPlan', () => {
  it('shouldRetry is true for first failed attempt', () => {
    const plan = buildRetryPlan(makeDelegation())
    expect(plan.shouldRetry).toBe(true)
  })

  it('shouldRetry is false when max retries reached', () => {
    const delegation = addRetryLog(makeDelegation(), 3)
    const plan = buildRetryPlan(delegation)
    expect(plan.shouldRetry).toBe(false)
    expect(plan.maxRetriesReached).toBe(true)
  })

  it('shouldRetry is false for non-failed status', () => {
    const plan = buildRetryPlan(makeDelegation({ status: 'running' }))
    expect(plan.shouldRetry).toBe(false)
  })

  it('failureCause is classified correctly', () => {
    const d = makeDelegation({ errorMessage: 'TypeScript error: cannot assign' })
    const plan = buildRetryPlan(d)
    expect(plan.failureCause).toBe('type-error')
  })

  it('retryCount matches number of previous retries', () => {
    const delegation = addRetryLog(makeDelegation(), 2)
    const plan = buildRetryPlan(delegation)
    expect(plan.retryCount).toBe(2)
  })

  it('backoffMs doubles with each retry', () => {
    const d0 = buildRetryPlan(makeDelegation())
    const d1 = buildRetryPlan(addRetryLog(makeDelegation(), 1))
    expect(d1.backoffMs).toBe(d0.backoffMs * 2)
  })

  it('additionalContext includes failure-specific guidance', () => {
    const d = makeDelegation({ errorMessage: 'ESLint violation in route.ts' })
    const plan = buildRetryPlan(d)
    expect(plan.additionalContext).toContain('ESLint')
  })

  it('improvedGoal matches original contract goal', () => {
    const plan = buildRetryPlan(makeDelegation())
    expect(plan.improvedGoal).toBe('Add JWT auth middleware')
  })

  it('diagnosticMessage is a non-empty string', () => {
    const plan = buildRetryPlan(makeDelegation())
    expect(typeof plan.diagnosticMessage).toBe('string')
    expect(plan.diagnosticMessage.length).toBeGreaterThan(0)
  })

  it('maxRetriesReached is false before limit', () => {
    const delegation = addRetryLog(makeDelegation(), 2)
    const plan = buildRetryPlan(delegation)
    expect(plan.maxRetriesReached).toBe(false)
    expect(plan.shouldRetry).toBe(true)
  })
})
