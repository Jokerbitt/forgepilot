import { describe, it, expect } from 'vitest'
import { decidePhaseGate } from './phase-gate'

describe('decidePhaseGate', () => {
  it('stops the chain when the build is red', () => {
    const d = decidePhaseGate({ buildPassed: false, testPassed: false })
    expect(d.proceed).toBe(false)
    expect(d.reason).toMatch(/Build-Gate fehlgeschlagen/)
  })

  it('proceeds when build and tests are green', () => {
    const d = decidePhaseGate({ buildPassed: true, testPassed: true })
    expect(d.proceed).toBe(true)
    expect(d.reason).toMatch(/Tests grün/)
  })

  it('stops the chain when the build is green but tests are red', () => {
    const d = decidePhaseGate({ buildPassed: true, testPassed: false })
    expect(d.proceed).toBe(false)
    expect(d.reason).toMatch(/Test-Gate fehlgeschlagen/)
  })

  it('proceeds on a test timeout (infra signal, not a code failure)', () => {
    const d = decidePhaseGate({ buildPassed: true, testPassed: false, testTimedOut: true })
    expect(d.proceed).toBe(true)
    expect(d.reason).toMatch(/Timeout/)
  })

  it('proceeds when there is no test script (test skipped)', () => {
    const d = decidePhaseGate({ buildPassed: true, testPassed: true, testSkipped: true })
    expect(d.proceed).toBe(true)
    expect(d.reason).toMatch(/kein Test-Script/)
  })

  it('proceeds when there is no build script but tests pass', () => {
    const d = decidePhaseGate({ buildPassed: true, buildSkipped: true, testPassed: true })
    expect(d.proceed).toBe(true)
    expect(d.reason).toMatch(/kein Build-Script/)
  })

  it('build red beats everything else', () => {
    const d = decidePhaseGate({ buildPassed: false, testPassed: true, testSkipped: true })
    expect(d.proceed).toBe(false)
  })
})
