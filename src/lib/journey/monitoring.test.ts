import { describe, it, expect } from 'vitest'
import { classifyLatency, summarizeOperations, SLOW_LATENCY_MS, type RouteCheck } from './monitoring'

const ok = (route: string, latencyMs: number, status = 200): RouteCheck => ({ route, status, ok: true, latencyMs })
const bad = (route: string, status = 0, error = 'nicht erreichbar'): RouteCheck => ({ route, status, ok: false, latencyMs: 0, error })

describe('classifyLatency', () => {
  it('buckets fast / ok / slow by thresholds', () => {
    expect(classifyLatency(100)).toBe('fast')
    expect(classifyLatency(299)).toBe('fast')
    expect(classifyLatency(300)).toBe('ok')
    expect(classifyLatency(SLOW_LATENCY_MS - 1)).toBe('ok')
    expect(classifyLatency(SLOW_LATENCY_MS)).toBe('slow')
    expect(classifyLatency(5000)).toBe('slow')
  })
})

describe('summarizeOperations', () => {
  it('healthy when all routes answer quickly', () => {
    const r = summarizeOperations('PlantVault', [ok('/', 120), ok('/login', 80)])
    expect(r.status).toBe('healthy')
    expect(r.headline).toMatch(/läuft stabil/)
    expect(r.okCount).toBe(2)
    expect(r.avgLatencyMs).toBe(100)
    expect(r.consecutiveFailures).toBe(0)
    expect(r.lines).toHaveLength(2)
  })

  it('degraded (partial) when some routes fail', () => {
    const r = summarizeOperations('App', [ok('/', 100), bad('/admin', 503)])
    expect(r.status).toBe('degraded')
    expect(r.headline).toMatch(/eingeschränkt/)
    expect(r.okCount).toBe(1)
  })

  it('degraded (slow) when all answer but the average is sluggish', () => {
    const r = summarizeOperations('App', [ok('/', 2000), ok('/x', 1800)])
    expect(r.status).toBe('degraded')
    expect(r.headline).toMatch(/langsam/)
    expect(r.avgLatencyMs).toBe(1900)
    expect(r.slowestRoute).toBe('/')
  })

  it('down when nothing answers — first outage has no streak suffix', () => {
    const r = summarizeOperations('App', [bad('/', 0, 'Zeitüberschreitung')], 0)
    expect(r.status).toBe('down')
    expect(r.consecutiveFailures).toBe(1)
    expect(r.headline).toMatch(/ist offline/)
    expect(r.headline).not.toMatch(/in Folge/)
  })

  it('down accumulates the failure streak across checks', () => {
    const r = summarizeOperations('App', [bad('/'), bad('/x')], 2)
    expect(r.status).toBe('down')
    expect(r.consecutiveFailures).toBe(3)
    expect(r.headline).toMatch(/3 Prüfungen in Folge/)
  })

  it('resets the streak once the app is reachable again', () => {
    const r = summarizeOperations('App', [ok('/', 100)], 5)
    expect(r.consecutiveFailures).toBe(0)
  })

  it('down with a friendly message when there are no routes', () => {
    const r = summarizeOperations('App', [])
    expect(r.status).toBe('down')
    expect(r.headline).toMatch(/Keine Seiten/)
  })

  it('flags slow routes in the detail lines', () => {
    const r = summarizeOperations('App', [ok('/', 100), ok('/slow', 2500)])
    expect(r.lines[1]).toMatch(/langsam/)
    expect(r.lines[0]).not.toMatch(/langsam/)
  })
})
