import { describe, it, expect } from 'vitest'
import { parseConcept, generateConcept } from './concept'
import { parseCritique, critiqueConcept } from './critic'

describe('parseConcept', () => {
  it('parses a full blueprint', () => {
    const c = parseConcept('{"overview":"A task app","appType":"SaaS","recommendations":["r1","r2"],"considerations":["c1"]}')
    expect(c).not.toBeNull()
    expect(c!.overview).toBe('A task app')
    expect(c!.recommendations).toEqual(['r1', 'r2'])
    expect(c!.considerations).toEqual(['c1'])
  })
  it('returns null without an overview', () => {
    expect(parseConcept('{"recommendations":["x"]}')).toBeNull()
    expect(parseConcept('garbage')).toBeNull()
  })
})

describe('generateConcept', () => {
  it('uses the AI blueprint when valid', async () => {
    const fake = async () => ({ text: '{"overview":"Clear","appType":"web app","recommendations":[],"considerations":[]}', provider: 'mock', model: 'm' })
    const c = await generateConcept({ goal: 'g', generate: fake })
    expect(c.overview).toBe('Clear')
  })
  it('falls back and reflects feedback in the loop', async () => {
    const boom = async () => { throw new Error('no ai') }
    const c = await generateConcept({ goal: 'A notes app', feedback: 'add tags', generate: boom })
    expect(c.overview).toContain('A notes app')
    expect(c.overview).toContain('add tags')
  })
})

describe('parseCritique / critiqueConcept', () => {
  it('flags hasFeedback when points exist', () => {
    const c = parseCritique('{"pros":["fast"],"cons":["scope"],"considerations":[],"verdict":"ok"}')
    expect(c.hasFeedback).toBe(true)
    expect(c.pros).toEqual(['fast'])
  })
  it('hasFeedback is false for an all-empty critique', () => {
    const c = parseCritique('{"pros":[],"cons":[],"considerations":[],"verdict":"solid"}')
    expect(c.hasFeedback).toBe(false)
    expect(c.verdict).toBe('solid')
  })
  it('critiqueConcept returns a no-feedback critique when AI is unavailable', async () => {
    const boom = async () => { throw new Error('no ai') }
    const c = await critiqueConcept({ goal: 'g', overview: 'o', generate: boom })
    expect(c.hasFeedback).toBe(false)
  })
})
