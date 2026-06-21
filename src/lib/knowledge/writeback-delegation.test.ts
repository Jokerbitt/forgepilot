/**
 * writeback-delegation.test.ts — M220
 * Tests for writebackDelegationKnowledge (separate from the existing writeback.test.ts
 * which covers writebackExecutionInsights).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ─── Mock dependencies ───────────────────────────────────────────────────────

const mockGenerateText = vi.fn()
vi.mock('@/lib/ai/text-generation', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}))

const mockWriteKnowledgeCard    = vi.fn()
const mockFindBySource          = vi.fn().mockReturnValue([])   // no existing cards by default
vi.mock('@/lib/knowledge/knowledge-card', () => ({
  writeKnowledgeCard:          (...args: unknown[]) => mockWriteKnowledgeCard(...args),
  findKnowledgeCardsBySource:  (...args: unknown[]) => mockFindBySource(...args),
}))

vi.mock('@/lib/logger', () => ({
  aiLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/lib/knowledge/nas-writeback', () => ({
  writeKnowledgeCardToNas: vi.fn(),
}))

// Import AFTER mocks are set up
import { writebackDelegationKnowledge, writeFailureLessonCard } from './writeback'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-test',
    title: 'Implement feature X',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-42',
      goal: 'Implement feature X',
      context: '',
      definitionOfDone: [],
      riskClass: 'B',
      maxBudgetUsd: 1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWriteKnowledgeCard.mockReturnValue({
    id: 'card-uuid-1',
    title: 'Implement feature X',
    content: '- learned something',
    source: 'delegation',
    sourceId: 'del-test',
    tags: ['delegation', 'B', 'claude-cli'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('writebackDelegationKnowledge', () => {
  it('happy path: LLM succeeds → card is written → written:true', async () => {
    mockGenerateText.mockResolvedValue({
      text: '- learned something useful\n- tests passed on first try',
      provider: 'anthropic',
      model: 'claude-haiku',
    })

    const result = await writebackDelegationKnowledge(
      makeDelegation(),
      'DONE: Implemented feature X successfully',
    )

    expect(result.written).toBe(true)
    expect(result.cardId).toBe('card-uuid-1')
    expect(mockWriteKnowledgeCard).toHaveBeenCalledOnce()
    // Content should be the LLM output
    const callArg = mockWriteKnowledgeCard.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.content).toContain('learned something useful')
  })

  it('quality gate: LLM throws with unstructured raw output → quality gate rejects, written:false', async () => {
    mockGenerateText.mockRejectedValue(new Error('LLM unavailable'))

    const result = await writebackDelegationKnowledge(
      makeDelegation(),
      'Some raw output from the agent',
    )

    // Raw output fallback has no bullet points → quality gate correctly rejects it
    expect(result.written).toBe(false)
    expect(result.reason).toBeDefined()
    expect(mockWriteKnowledgeCard).not.toHaveBeenCalled()
  })

  it('tags include delegation, riskClass, and executionRoute', async () => {
    mockGenerateText.mockResolvedValue({ text: '- tag test', provider: 'anthropic', model: 'haiku' })

    await writebackDelegationKnowledge(
      makeDelegation({ contract: { ...makeDelegation().contract, riskClass: 'A' }, executionRoute: 'ollama-agent' }),
      'output',
    )

    const callArg = mockWriteKnowledgeCard.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.tags).toContain('delegation')
    expect(callArg.tags).toContain('A')
    expect(callArg.tags).toContain('ollama-agent')
  })

  it('includes briefId and prUrl when present on delegation', async () => {
    mockGenerateText.mockResolvedValue({ text: '- with brief', provider: 'anthropic', model: 'haiku' })

    await writebackDelegationKnowledge(
      makeDelegation({
        briefId: 'brief-99',
        summaryReport: {
          keyPoints: [],
          changes: [],
          timeTakenMinutes: 3,
          prUrl: 'https://github.com/org/repo/pull/7',
        },
      }),
      'output',
    )

    const callArg = mockWriteKnowledgeCard.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.briefId).toBe('brief-99')
    expect(callArg.prUrl).toBe('https://github.com/org/repo/pull/7')
  })

  it('returns written:false when writeKnowledgeCard itself throws', async () => {
    mockGenerateText.mockResolvedValue({ text: '- ok', provider: 'anthropic', model: 'haiku' })
    mockWriteKnowledgeCard.mockImplementation(() => {
      throw new Error('disk full')
    })

    const result = await writebackDelegationKnowledge(makeDelegation(), 'output')
    expect(result.written).toBe(false)
    expect(result.reason).toContain('disk full')
  })

  it('truncates executionOutput to 500 chars in LLM prompt', async () => {
    let capturedPrompt = ''
    mockGenerateText.mockImplementation((opts: { prompt: string }) => {
      capturedPrompt = opts.prompt
      return Promise.resolve({ text: '- ok', provider: 'anthropic', model: 'haiku' })
    })

    const longOutput = 'x'.repeat(1000)
    await writebackDelegationKnowledge(makeDelegation(), longOutput)

    // The truncated output in the prompt should be at most 500 chars
    // Split on the marker and take everything up to the next newline
    const afterMarker = capturedPrompt.split('Output (max 500 Zeichen): ')[1] ?? ''
    const truncatedPart = afterMarker.split('\n')[0] ?? ''
    expect(truncatedPart.length).toBeLessThanOrEqual(500)
    expect(truncatedPart).toBe('x'.repeat(500))
  })
})

// ─── writeFailureLessonCard ───────────────────────────────────────────────────

describe('writeFailureLessonCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindBySource.mockReturnValue([])
    mockWriteKnowledgeCard.mockReturnValue({
      id: 'failure-card-1',
      title: '[FAILED] test goal',
      content: '- something went wrong',
      source: 'delegation',
      sourceId: 'del-fail',
      tags: ['failure-lesson', 'unknown', 'B', 'local-agent'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  })

  it('writes a failure lesson card and returns written:true', async () => {
    mockGenerateText.mockResolvedValue({ text: '- something went wrong\n- avoid X', provider: 'anthropic', model: 'haiku' })

    const delegation = makeDelegation({
      id: 'del-fail',
      status: 'failed',
      errorMessage: 'TypeScript compilation failed',
      logs: [
        { timestamp: new Date().toISOString(), type: 'error', message: 'error TS2345: Argument ...' },
      ],
    })

    const result = await writeFailureLessonCard(delegation)
    expect(result.written).toBe(true)
    expect(result.cardId).toBe('failure-card-1')
    expect(mockWriteKnowledgeCard).toHaveBeenCalledOnce()
  })

  it('tags include failure-lesson, targetRepo, riskClass, and executionRoute', async () => {
    mockGenerateText.mockResolvedValue({ text: '- lesson', provider: 'anthropic', model: 'haiku' })

    await writeFailureLessonCard(
      makeDelegation({
        id: 'del-fail',
        status: 'failed',
        targetRepo: '/workspaces/my-repo',
        errorMessage: 'failed',
      }),
    )

    const callArg = mockWriteKnowledgeCard.mock.calls[0][0] as Record<string, unknown>
    expect((callArg.tags as string[])).toContain('failure-lesson')
    expect((callArg.tags as string[])).toContain('/workspaces/my-repo')
  })

  it('skips when a failure-lesson card already exists for the delegation', async () => {
    mockFindBySource.mockReturnValue([
      { id: 'existing', tags: ['failure-lesson'], sourceId: 'del-fail' },
    ])

    const result = await writeFailureLessonCard(makeDelegation({ id: 'del-fail', status: 'failed' }))
    expect(result.written).toBe(false)
    expect(result.reason).toContain('Failure card already exists')
    expect(mockWriteKnowledgeCard).not.toHaveBeenCalled()
  })

  it('falls back to raw content when LLM fails', async () => {
    mockGenerateText.mockRejectedValue(new Error('LLM timeout'))

    const result = await writeFailureLessonCard(
      makeDelegation({ id: 'del-fail', status: 'failed', errorMessage: 'some raw error' }),
    )

    // Falls back to raw content — card is still written
    expect(result.written).toBe(true)
    const callArg = mockWriteKnowledgeCard.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.content as string).toContain('some raw error')
  })

  it('returns written:false when writeKnowledgeCard throws', async () => {
    mockGenerateText.mockResolvedValue({ text: '- ok', provider: 'anthropic', model: 'haiku' })
    mockWriteKnowledgeCard.mockImplementation(() => { throw new Error('disk full') })

    const result = await writeFailureLessonCard(makeDelegation({ id: 'del-fail', status: 'failed' }))
    expect(result.written).toBe(false)
    expect(result.reason).toContain('disk full')
  })
})
