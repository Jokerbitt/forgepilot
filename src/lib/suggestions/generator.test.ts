import { describe, it, expect } from 'vitest'
import { parseSuggestions, generateSuggestions } from './generator'

describe('parseSuggestions', () => {
  it('parses a clean JSON array', () => {
    const out = parseSuggestions('[{"title":"Add search","description":"Full-text search"}]')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 's1', title: 'Add search', description: 'Full-text search' })
  })

  it('extracts JSON from a fenced block', () => {
    const out = parseSuggestions('Here you go:\n```json\n[{"title":"A","description":"d"}]\n```')
    expect(out).toHaveLength(1)
    expect(out[0]!.title).toBe('A')
  })

  it('extracts a bare array embedded in prose', () => {
    const out = parseSuggestions('Sure! [{"title":"X","description":"y"}] done')
    expect(out[0]!.title).toBe('X')
  })

  it('skips items without a title and caps the count', () => {
    const raw = JSON.stringify([
      { title: 'Keep', description: 'ok' },
      { description: 'no title' },
      { title: 'Also', description: 'ok' },
      { title: 'Third', description: 'ok' },
    ])
    const out = parseSuggestions(raw, 2)
    expect(out).toHaveLength(2)
    expect(out.map(s => s.title)).toEqual(['Keep', 'Also'])
  })

  it('returns [] for non-JSON or non-array', () => {
    expect(parseSuggestions('no json here')).toEqual([])
    expect(parseSuggestions('{"title":"obj"}')).toEqual([])
    expect(parseSuggestions('[broken')).toEqual([])
  })
})

describe('generateSuggestions', () => {
  it('uses the injected generator and returns parsed suggestions', async () => {
    const fake = async () => ({ text: '[{"title":"AI copilot","description":"goal to tasks"}]', provider: 'mock', model: 'm' })
    const out = await generateSuggestions({ goal: 'Improve app', generate: fake })
    expect(out).toHaveLength(1)
    expect(out[0]!.title).toBe('AI copilot')
  })

  it('falls back to [] when the generator throws', async () => {
    const boom = async () => { throw new Error('no provider') }
    const out = await generateSuggestions({ goal: 'x', generate: boom })
    expect(out).toEqual([])
  })
})
