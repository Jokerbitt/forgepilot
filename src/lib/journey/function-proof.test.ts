import { describe, it, expect } from 'vitest'
import { normalizeRoutes, isProbeOk, summarizeProof, defaultProbeRoutes, type ProbeResult } from './function-proof'

describe('normalizeRoutes', () => {
  it('prefixes slashes and de-duplicates', () => {
    expect(normalizeRoutes(['foo', '/foo', '/bar'])).toEqual(['/foo', '/bar'])
  })
  it('falls back to the default when empty', () => {
    expect(normalizeRoutes([])).toEqual(defaultProbeRoutes())
    expect(normalizeRoutes(undefined)).toEqual(['/'])
  })
})

describe('isProbeOk', () => {
  it('treats 2xx/3xx/4xx as reachable but 5xx/0 as not', () => {
    expect(isProbeOk(200)).toBe(true)
    expect(isProbeOk(302)).toBe(true)
    expect(isProbeOk(404)).toBe(true) // server answered
    expect(isProbeOk(500)).toBe(false)
    expect(isProbeOk(0)).toBe(false)
  })
})

describe('summarizeProof', () => {
  const ok: ProbeResult = { route: '/', status: 200, ok: true }
  const bad: ProbeResult = { route: '/x', status: 0, ok: false, error: 'refused' }

  it('verdict works when all probes pass', () => {
    const r = summarizeProof('PlantVault', [ok, { route: '/a', status: 200, ok: true }])
    expect(r.verdict).toBe('works')
    expect(r.headline).toMatch(/läuft/)
    expect(r.okCount).toBe(2)
  })
  it('verdict partial when some pass', () => {
    expect(summarizeProof('App', [ok, bad]).verdict).toBe('partial')
  })
  it('verdict failed when none pass', () => {
    expect(summarizeProof('App', [bad]).verdict).toBe('failed')
  })
  it('verdict failed for no probes', () => {
    expect(summarizeProof('App', []).verdict).toBe('failed')
  })
})
