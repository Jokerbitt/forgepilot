import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/text-generation', () => ({
  generateText: vi.fn(),
  stripJsonCodeFence: vi.fn((s: string) => s),
  AIProviderConfigurationError: class extends Error { constructor(msg: string) { super(msg) } },
}))
vi.mock('@/lib/validation/api', () => ({
  parseBody: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { generateText } from '@/lib/ai/text-generation'
import { parseBody } from '@/lib/validation/api'
import { POST } from './route'
import type { NextRequest } from 'next/server'

const mockGenerate = vi.mocked(generateText)
const mockParseBody = vi.mocked(parseBody)

function mockReq(): NextRequest {
  return {} as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/idea/refine', () => {
  it('returns 400 when validation fails', async () => {
    const { NextResponse } = await import('next/server')
    mockParseBody.mockResolvedValue(NextResponse.json({ error: 'Validation failed' }, { status: 400 }))
    const res = await POST(mockReq())
    expect(res.status).toBe(400)
  })

  it('phase 1: returns questions when no answers provided', async () => {
    mockParseBody.mockResolvedValue({ idea: 'Build a task management app for remote teams' })
    mockGenerate.mockResolvedValue({
      text: '["Who are the primary users?","What platforms?","How does success look?","Any budget constraints?"]',
      provider: 'anthropic', model: 'claude-3-haiku', inputTokens: 100, outputTokens: 50,
    })
    const res = await POST(mockReq())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.phase).toBe('questions')
    expect(Array.isArray(data.questions)).toBe(true)
    expect(data.questions).toHaveLength(4)
  })

  it('phase 2: returns brief when answers are provided', async () => {
    mockParseBody.mockResolvedValue({
      idea: 'Build a task management app',
      answers: [
        { question: 'Who are the users?', answer: 'Remote software teams' },
        { question: 'What platforms?', answer: 'Web only' },
      ],
    })
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        title: 'TeamTask — Remote Work Manager',
        problemStatement: 'Remote teams lack a focused tool for async task coordination.',
        desiredOutcome: 'Teams reduce meeting time by 30% through better async coordination.',
        targetAudience: 'Remote software development teams of 5-20 people.',
        nonGoals: ['Mobile app', 'Chat functionality'],
        successCriteria: ['Teams create 10+ tasks per week', 'NPS > 40'],
        technicalConstraints: 'Must work on web browsers',
        scope: 'standard',
      }),
      provider: 'anthropic', model: 'claude-3-haiku', inputTokens: 200, outputTokens: 150,
    })
    const res = await POST(mockReq())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.phase).toBe('brief')
    expect(data.brief.title).toBe('TeamTask — Remote Work Manager')
    expect(data.brief.scope).toBe('standard')
    expect(data.brief.successCriteria).toHaveLength(2)
  })

  it('returns 503 when AI provider not configured', async () => {
    const { AIProviderConfigurationError } = await import('@/lib/ai/text-generation')
    mockParseBody.mockResolvedValue({ idea: 'My great idea for testing' })
    mockGenerate.mockRejectedValue(new AIProviderConfigurationError('No API key'))
    const res = await POST(mockReq())
    expect(res.status).toBe(503)
  })

  it('returns 500 on JSON parse error from AI', async () => {
    mockParseBody.mockResolvedValue({ idea: 'My great idea for testing' })
    mockGenerate.mockResolvedValue({
      text: 'NOT VALID JSON AT ALL',
      provider: 'anthropic', model: 'claude-3-haiku', inputTokens: 10, outputTokens: 5,
    })
    const res = await POST(mockReq())
    expect(res.status).toBe(500)
  })
})
