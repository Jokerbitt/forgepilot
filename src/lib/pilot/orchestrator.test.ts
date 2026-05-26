import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PilotRunResult } from './types'

vi.mock('@/lib/policy/engine', () => ({
  evaluatePolicy: vi.fn(() => ({
    verdict: 'allow',
    violations: [],
    reason: 'All policy rules passed.',
    requiresHumanApproval: false,
    evaluatedAt: '2026-05-18T00:00:00Z',
  })),
}))

vi.mock('@/lib/model-router/router', () => ({
  routeTask: vi.fn(() => ({
    id: 'rd-1',
    taskId: 'wi-1',
    selectedModelProfileId: 'anthropic-haiku',
    selectedProvider: 'anthropic',
    selectedModel: 'claude-haiku-4-5',
    workload: 'coding',
    reason: 'Selected for coding workload.',
    privacyMode: 'hybrid',
    requiresApproval: false,
    createdAt: '2026-05-18T00:00:00Z',
  })),
}))

vi.mock('@/lib/model-router/store', () => ({
  saveDecision: vi.fn((d) => d),
}))

vi.mock('@/lib/agents/registry', () => ({
  pickAgentForWorkload: vi.fn(() => ({
    id: 'backend-engineer',
    role: 'backend-engineer',
    autonomyLevel: 'supervised-write',
    availability: 'available',
  })),
}))

vi.mock('@/lib/agent-runs/store', () => ({
  createRun: vi.fn(() => ({
    id: 'run-pilot-1',
    delegationId: 'wi-1',
    contractId: 'contract-x',
    status: 'queued',
    model: 'claude-haiku-4-5',
    startedAt: '2026-05-18T00:00:00Z',
    totalCostUsd: 0,
    tokenInput: 0,
    tokenOutput: 0,
    traceEvents: [],
  })),
  updateRun: vi.fn((id, patch) => ({ id, ...patch })),
  getRun: vi.fn(() => ({
    id: 'run-pilot-1',
    delegationId: 'wi-1',
    contractId: 'contract-x',
    status: 'completed',
    model: 'claude-haiku-4-5',
    startedAt: '2026-05-18T00:00:00Z',
    completedAt: '2026-05-18T00:05:00Z',
    totalCostUsd: 0.001,
    tokenInput: 200,
    tokenOutput: 50,
    traceEvents: [],
    resultSummary: 'Pilot run completed.',
  })),
}))

vi.mock('@/lib/writeback/summary', () => ({
  buildRunSummary: vi.fn(() => ({
    markdown: '# Agent Run\n\nTest Task\n',
    lessonProposal: undefined,
  })),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'default-user',
  createDelegationRepository: vi.fn(() => ({
    create: vi.fn(async (d: Record<string, unknown>) => ({ ...d, id: d.id ?? 'del-pilot-test' })),
    findById: vi.fn(),
    findAll: vi.fn(() => []),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}))

// Mock AI plan generation to prevent real API calls (avoids 5s timeout)
vi.mock('@/lib/pilot/ai-plan', () => ({
  generateExecutionPlan: vi.fn(() =>
    Promise.resolve({
      summary: 'Implement feature X in 3 steps',
      steps: ['Analyse codebase', 'Write implementation', 'Add tests'],
      estimatedComplexity: 'medium' as const,
      suggestedApproach: 'TDD with incremental commits',
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      inputTokens: 100,
      outputTokens: 200,
    }),
  ),
  buildFallbackPlan: vi.fn(() => ({
    summary: 'Static fallback plan',
    steps: ['Analyse', 'Implement', 'Test'],
    estimatedComplexity: 'low' as const,
    suggestedApproach: 'Direct implementation',
    provider: 'fallback',
    model: 'none',
  })),
}))

// Stub global fetch to prevent fire-and-forget execute from hitting real network
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })))

import { runPilot } from './orchestrator'

beforeEach(() => { vi.clearAllMocks() })

describe('runPilot', () => {
  it('completes all steps for a valid input', async () => {
    const result = await runPilot({
      workItemId: 'wi-1',
      title: 'Test Task',
      goal: 'Implement feature X',
    })
    expect(result.status).toBe('completed')
    expect(result.steps).toHaveLength(6)
    expect(result.steps.every(s => s.status !== 'error')).toBe(true)
  })

  it('returns id, workItemId, title in result', async () => {
    const result = await runPilot({
      workItemId: 'wi-2',
      title: 'My Task',
      goal: 'Do something',
    })
    expect(result.workItemId).toBe('wi-2')
    expect(result.title).toBe('My Task')
    expect(result.id).toBeTruthy()
  })

  it('step names are present', async () => {
    const result = await runPilot({
      workItemId: 'wi-3',
      title: 'T',
      goal: 'G',
    })
    const stepNames = result.steps.map(s => s.step)
    expect(stepNames).toContain('policy-check')
    expect(stepNames).toContain('model-routing')
    expect(stepNames).toContain('agent-selection')
    expect(stepNames).toContain('agent-run-create')
    expect(stepNames).toContain('writeback')
    expect(stepNames).toContain('delegation-create')
  })

  it('fails when policy denies the contract', async () => {
    const { evaluatePolicy } = await import('@/lib/policy/engine')
    vi.mocked(evaluatePolicy).mockReturnValueOnce({
      verdict: 'deny',
      violations: [{ ruleId: 'risk-class-c', message: 'Risk Class C', severity: 'blocking' }],
      reason: 'Blocked: Risk Class C',
      requiresHumanApproval: true,
      evaluatedAt: '2026-05-18T00:00:00Z',
    })

    const result = await runPilot({
      workItemId: 'wi-4',
      title: 'Risky Task',
      goal: 'Dangerous operation',
      riskClass: 'C',
    })
    expect(result.status).toBe('failed')
    expect(result.steps[0].status).toBe('error')
    expect(result.steps[0].error).toContain('Policy denied')
  })

  it('each step records durationMs', async () => {
    const result = await runPilot({ workItemId: 'wi-5', title: 'T', goal: 'G' })
    for (const step of result.steps) {
      expect(typeof step.durationMs).toBe('number')
      expect(step.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('result has totalDurationMs and timestamps', async () => {
    const result: PilotRunResult = await runPilot({ workItemId: 'wi-6', title: 'T', goal: 'G' })
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0)
    expect(result.startedAt).toBeTruthy()
    expect(result.completedAt).toBeTruthy()
  })

  it('result includes delegationId and executionStarted after delegation-create step', async () => {
    const result = await runPilot({ workItemId: 'wi-8', title: 'Delegation Test', goal: 'Create and execute delegation' })
    expect(result.delegationId).toBeTruthy()
    expect(result.executionStarted).toBe(true)
  })

  it('fires execute fetch for the created delegation', async () => {
    await runPilot({ workItemId: 'wi-9', title: 'Fire Execute', goal: 'Should trigger execute fetch' })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/delegations/'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('propagates privacyMode to routing step', async () => {
    const { routeTask } = await import('@/lib/model-router/router')
    await runPilot({
      workItemId: 'wi-7',
      title: 'T',
      goal: 'G',
      privacyMode: 'local-only',
    })
    expect(vi.mocked(routeTask)).toHaveBeenCalledWith(
      expect.objectContaining({ privacyMode: 'local-only' }),
    )
  })
})
