import { describe, it, expect, vi } from 'vitest'
import { runResearchAgent } from './research-agent'
import type { ResearchDocument } from '@/lib/models/research'

const baseDoc: ResearchDocument = {
  id: 'test-1',
  topic: 'Impact of AI on knowledge work',
  status: 'running',
  keyFindings: [],
  sections: [],
  citations: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function makeApiResponse(content: string) {
  return new Response(
    JSON.stringify({
      id: 'msg-1',
      content: [{ type: 'text', text: content }],
      usage: { input_tokens: 100, output_tokens: 200 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

const validPayload = {
  abstract: 'AI significantly augments knowledge worker productivity.',
  keyFindings: ['Finding 1', 'Finding 2'],
  sections: [
    {
      heading: 'Overview',
      content: 'AI tools have transformed how knowledge workers operate.',
      citations: ['cit-1'],
    },
  ],
  citations: [
    {
      id: 'cit-1',
      title: 'The Future of Work',
      url: 'https://example.com/paper',
      author: 'Smith J.',
      publishedAt: '2024-01-01',
      credibility: 'academic' as const,
      excerpt: 'Research shows a 40% productivity increase.',
    },
  ],
  tags: ['ai', 'productivity'],
}

describe('runResearchAgent', () => {
  it('parses a valid JSON response into ResearchDocument fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    const result = await runResearchAgent(baseDoc, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch })

    expect(result.abstract).toBe(validPayload.abstract)
    expect(result.keyFindings).toHaveLength(2)
    expect(result.sections).toHaveLength(1)
    expect(result.sections![0].heading).toBe('Overview')
    expect(result.citations).toHaveLength(1)
    expect(result.citations![0].credibility).toBe('academic')
    expect(result.tags).toEqual(['ai', 'productivity'])
    expect(result.tokenUsage?.promptTokens).toBe(100)
    expect(result.tokenUsage?.completionTokens).toBe(200)
  })

  it('strips markdown fences from response before parsing', async () => {
    const wrapped = '```json\n' + JSON.stringify(validPayload) + '\n```'
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(wrapped))

    const result = await runResearchAgent(baseDoc, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch })

    expect(result.abstract).toBe(validPayload.abstract)
  })

  it('throws when response is not valid JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse('This is not JSON at all'))

    await expect(
      runResearchAgent(baseDoc, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow('Could not parse research response as JSON')
  })

  it('throws on non-200 API response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    )

    await expect(
      runResearchAgent(baseDoc, { apiKey: 'bad-key', fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow('Anthropic API 401')
  })

  it('sends request to Anthropic messages endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await runResearchAgent(baseDoc, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch })

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'sk-test' }),
      }),
    )
  })

  it('defaults to claude-opus-4-7 model', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeApiResponse(JSON.stringify(validPayload)))

    await runResearchAgent(baseDoc, { apiKey: 'sk-test', fetcher: fetcher as unknown as typeof fetch })

    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string) as { model: string }
    expect(body.model).toBe('claude-opus-4-7')
  })
})
