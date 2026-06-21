import { describe, it, expect } from 'vitest'
import { parseRefinement, deriveAppName, refineIdea } from './brainstorm'

describe('parseRefinement', () => {
  it('parses a clean object', () => {
    const r = parseRefinement('{"goal":"Build a recipe app","appName":"Cookly","appType":"web app","directions":["A","B"]}')
    expect(r).not.toBeNull()
    expect(r!.goal).toBe('Build a recipe app')
    expect(r!.appName).toBe('Cookly')
    expect(r!.directions).toEqual(['A', 'B'])
  })

  it('extracts JSON from a fenced block and caps directions at 3', () => {
    const r = parseRefinement('```json\n{"goal":"g","directions":["1","2","3","4"]}\n```')
    expect(r!.directions).toHaveLength(3)
  })

  it('derives an app name and defaults appType when missing', () => {
    const r = parseRefinement('{"goal":"Track personal expenses easily"}')
    expect(r!.appType).toBe('web app')
    expect(r!.appName.length).toBeGreaterThan(0)
  })

  it('returns null without a goal', () => {
    expect(parseRefinement('{"appName":"X"}')).toBeNull()
    expect(parseRefinement('not json')).toBeNull()
  })
})

describe('deriveAppName', () => {
  it('builds a name from significant words', () => {
    expect(deriveAppName('Track personal expenses')).toBe('TrackPersonal')
    expect(deriveAppName('!!!')).toBe('MyApp')
  })
})

describe('refineIdea', () => {
  it('uses the AI result when valid', async () => {
    const fake = async () => ({ text: '{"goal":"Clear goal","appName":"Neat","appType":"SaaS","directions":["x"]}', provider: 'mock', model: 'm' })
    const r = await refineIdea({ idea: 'rough', generate: fake })
    expect(r.goal).toBe('Clear goal')
    expect(r.appType).toBe('SaaS')
  })

  it('falls back to a direct framing when AI fails', async () => {
    const boom = async () => { throw new Error('no ai') }
    const r = await refineIdea({ idea: 'a budget tracker for families', generate: boom })
    expect(r.goal).toBe('a budget tracker for families')
    expect(r.appName.length).toBeGreaterThan(0)
    expect(r.directions).toEqual([])
  })
})
