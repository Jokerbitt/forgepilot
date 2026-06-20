import { describe, it, expect } from 'vitest'
import { assessCriticality, criticalityNote } from './criticality'

/** Fake probe: matches when any keyword appears in the provided "corpus" string. */
function probeFrom(corpus: string) {
  return (_root: string, pattern: string) => new RegExp(pattern, 'i').test(corpus)
}

describe('assessCriticality', () => {
  it('flags a Leitrechner app name as critical', () => {
    const a = assessCriticality('Leitrechner', '/x', probeFrom(''))
    expect(a.level).toBe('critical')
    expect(a.reasons.length).toBeGreaterThan(0)
  })

  it('flags industrial protocols in code as critical', () => {
    const a = assessCriticality('MyApp', '/x', probeFrom('client.connectModbus(); var s7 = new SiemensS7();'))
    expect(a.level).toBe('critical')
  })

  it('marks real-time as sensitive (not critical) on its own', () => {
    const a = assessCriticality('Dashboard', '/x', probeFrom('needs real-time updates'))
    expect(a.level).toBe('sensitive')
  })

  it('returns normal for an ordinary business app', () => {
    const a = assessCriticality('InvoiceApp', '/x', probeFrom('export const x = 1'))
    expect(a.level).toBe('normal')
  })

  it('escalates to the highest matched level', () => {
    const a = assessCriticality('App', '/x', probeFrom('real-time SCADA control'))
    expect(a.level).toBe('critical')
  })
})

describe('criticalityNote', () => {
  it('produces a blocking note for critical', () => {
    expect(criticalityNote({ level: 'critical', reasons: ['SCADA'] })).toMatch(/Kein autonomer Nachbau/)
  })
  it('produces a caution note for sensitive', () => {
    expect(criticalityNote({ level: 'sensitive', reasons: ['Echtzeit'] })).toMatch(/Sorgfalt/)
  })
  it('produces an all-clear for normal', () => {
    expect(criticalityNote({ level: 'normal', reasons: [] })).toMatch(/Keine kritischen/)
  })
})
