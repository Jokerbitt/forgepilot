import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./ollama-client', () => ({
  ollamaChat: vi.fn(),
  ollamaEmbed: vi.fn(),
  getOllamaBaseUrl: () => 'http://localhost:11434',
}))

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: () => ({ localFastModel: 'llama3.2:3b', localCodingModel: 'codellama:7b' }),
}))

import { ollamaChat, ollamaEmbed } from './ollama-client'
import {
  embed,
  classify,
  summarize,
  compressContext,
  cosineSimilarity,
} from './ollama-workloads'

afterEach(() => { vi.resetAllMocks() })

describe('embed', () => {
  it('returns vector from ollama embed', async () => {
    vi.mocked(ollamaEmbed).mockResolvedValueOnce([0.1, 0.2, 0.3])
    const result = await embed('hello world')
    expect(result.vector).toEqual([0.1, 0.2, 0.3])
    expect(result.dimensions).toBe(3)
    expect(result.model).toBe('bge-m3')
    expect(vi.mocked(ollamaEmbed)).toHaveBeenCalledWith('bge-m3', 'hello world')
  })

  it('uses custom model when provided', async () => {
    vi.mocked(ollamaEmbed).mockResolvedValueOnce([0.5])
    await embed('test', 'nomic-embed-text')
    expect(vi.mocked(ollamaEmbed)).toHaveBeenCalledWith('nomic-embed-text', 'test')
  })
})

describe('classify', () => {
  it('returns matched label for exact response', async () => {
    vi.mocked(ollamaChat).mockResolvedValueOnce({ text: 'bug' })
    const result = await classify('app crashes on login', ['bug', 'feature', 'chore'])
    expect(result.label).toBe('bug')
    expect(result.confidence).toBe('high')
    expect(result.model).toBe('llama3.2:3b')
  })

  it('falls back to first label on no match', async () => {
    vi.mocked(ollamaChat).mockResolvedValueOnce({ text: 'unknown category entirely' })
    const result = await classify('some text', ['alpha', 'beta'])
    expect(['alpha', 'beta']).toContain(result.label)
  })

  it('uses custom model when provided', async () => {
    vi.mocked(ollamaChat).mockResolvedValueOnce({ text: 'feature' })
    await classify('add dark mode', ['bug', 'feature'], 'gemma3:4b')
    expect(vi.mocked(ollamaChat)).toHaveBeenCalledWith(
      'gemma3:4b',
      expect.any(String),
      expect.any(String),
      32,
    )
  })
})

describe('summarize', () => {
  it('returns summary text with token counts', async () => {
    vi.mocked(ollamaChat).mockResolvedValueOnce({
      text: 'Short summary.',
      inputTokens: 100,
      outputTokens: 10,
    })
    const result = await summarize('Long text about something important.')
    expect(result.summary).toBe('Short summary.')
    expect(result.inputTokens).toBe(100)
    expect(result.outputTokens).toBe(10)
    expect(result.model).toBe('llama3.2:3b')
  })

  it('uses maxSentences to cap output tokens', async () => {
    vi.mocked(ollamaChat).mockResolvedValueOnce({ text: 'Ok.' })
    await summarize('text', 5)
    const call = vi.mocked(ollamaChat).mock.calls[0]
    expect(call[3]).toBe(5 * 80)
  })
})

describe('compressContext', () => {
  it('skips compression when already within budget', async () => {
    const short = 'Short content.'
    const result = await compressContext(short, 10000)
    expect(result.compressed).toBe(short)
    expect(vi.mocked(ollamaChat)).not.toHaveBeenCalled()
  })

  it('compresses when over budget', async () => {
    const big = 'x'.repeat(10000)
    vi.mocked(ollamaChat).mockResolvedValueOnce({ text: 'Compressed.' })
    const result = await compressContext(big, 100)
    expect(result.compressed).toBe('Compressed.')
    expect(result.originalTokenEstimate).toBeGreaterThan(100)
    expect(result.compressedTokenEstimate).toBeLessThan(result.originalTokenEstimate)
  })
})

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', async () => {
    const sim = await cosineSimilarity([1, 0, 0], [1, 0, 0])
    expect(sim).toBeCloseTo(1.0)
  })

  it('returns 0.0 for orthogonal vectors', async () => {
    const sim = await cosineSimilarity([1, 0], [0, 1])
    expect(sim).toBeCloseTo(0.0)
  })

  it('returns 0.0 for zero vectors', async () => {
    const sim = await cosineSimilarity([0, 0], [0, 0])
    expect(sim).toBe(0)
  })

  it('throws for dimension mismatch', async () => {
    await expect(cosineSimilarity([1, 2], [1])).rejects.toThrow('dimension mismatch')
  })
})
