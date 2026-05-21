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

const mockWriteKnowledgeCard = vi.fn()
vi.mock('@/lib/knowledge/knowledge-card', () => ({
  writeKnowledgeCard: (...args: unknown[]) => mockWriteKnowledgeCard(...args),
}))

vi.mock('@/lib/logger', () => ({
  aiLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Import AFTER mocks are set up
import { writebackDelegationKnowledge } from './writeback'

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

  it('fail-open: LLM throws → card still written with raw output', async () => {
    mockGenerateText.mockRejectedValue(new Error('LLM unavailable'))

    const result = await writebackDelegationKnowledge(
      makeDelegation(),
      'Some raw output from the agent',
    )

    expect(result.written).toBe(true)
    expect(result.cardId).toBe('card-uuid-1')
    expect(mockWriteKnowledgeCard).toHaveBeenCalledOnce()
    // Content should fall back to raw data
    const callArg = mockWriteKnowledgeCard.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.content).toContain('Raw execution output')
    expect(callArg.content).toContain('Some raw output from the agent')
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
