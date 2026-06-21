import { describe, it, expect } from 'vitest'
import { explainError, humanizeDelegationProgress, humanizePlanProgress, type ProgressInput } from './progress'

describe('explainError', () => {
  it('maps known technical errors to plain German', () => {
    expect(explainError('error TS2322: type mismatch')).toMatch(/Typ-Fehler/)
    expect(explainError('vitest failed: assertion error')).toMatch(/Test/)
    expect(explainError('Cannot find module foo')).toMatch(/Komponente fehlte/)
    expect(explainError('next build failed')).toMatch(/Build/)
    expect(explainError('budget cap reached')).toMatch(/Budget/)
  })
  it('falls back to the first line for unknown errors', () => {
    expect(explainError('Weird custom failure\nstack...')).toMatch(/Weird custom failure/)
  })
  it('handles empty input', () => {
    expect(explainError()).toMatch(/Problem/)
  })
})

describe('humanizeDelegationProgress', () => {
  const base: ProgressInput = { title: 'Datenbank anlegen', status: 'running', chainPosition: 2, chainTotal: 5 }

  it('shows a running step with the step counter', () => {
    const v = humanizeDelegationProgress(base)
    expect(v.state).toBe('running')
    expect(v.detail).toBe('Schritt 2 von 5')
  })

  it('makes self-healing visible on retry', () => {
    const v = humanizeDelegationProgress({ ...base, retryCount: 1 })
    expect(v.state).toBe('retrying')
    expect(v.detail).toMatch(/Variante 2/)
    expect(v.detail).toMatch(/bessert/)
  })

  it('explains a failure in plain German', () => {
    const v = humanizeDelegationProgress({ title: 'x', status: 'failed', errorMessage: 'error TS2345' })
    expect(v.state).toBe('failed')
    expect(v.detail).toMatch(/Typ-Fehler/)
  })

  it('shows budget pause as resumable', () => {
    const v = humanizeDelegationProgress({ title: 'x', status: 'failed', budgetPaused: true })
    expect(v.state).toBe('paused')
    expect(v.detail).toMatch(/fortgesetzt/)
  })

  it('shows waiting and done states', () => {
    expect(humanizeDelegationProgress({ title: 'x', status: 'pending' }).state).toBe('waiting')
    expect(humanizeDelegationProgress({ title: 'x', status: 'completed' }).state).toBe('done')
  })
})

describe('humanizePlanProgress', () => {
  it('reports the running step number', () => {
    const items: ProgressInput[] = [
      { title: 'A', status: 'completed' },
      { title: 'B', status: 'running' },
      { title: 'C', status: 'pending' },
    ]
    const v = humanizePlanProgress(items)
    expect(v.state).toBe('running')
    expect(v.done).toBe(1)
    expect(v.total).toBe(3)
    expect(v.headline).toMatch(/Schritt 2 von 3/)
    expect(v.headline).toMatch(/B/)
  })

  it('celebrates when everything is done', () => {
    const v = humanizePlanProgress([{ title: 'A', status: 'completed' }, { title: 'B', status: 'completed' }])
    expect(v.state).toBe('done')
    expect(v.headline).toMatch(/fertig/)
  })

  it('surfaces a failed step', () => {
    const v = humanizePlanProgress([{ title: 'A', status: 'completed' }, { title: 'B', status: 'failed', errorMessage: 'boom' }])
    expect(v.state).toBe('failed')
    expect(v.headline).toMatch(/Schritt 2 von 2/)
  })

  it('surfaces a budget pause', () => {
    const v = humanizePlanProgress([{ title: 'A', status: 'failed', budgetPaused: true }])
    expect(v.state).toBe('paused')
  })

  it('handles an empty plan', () => {
    expect(humanizePlanProgress([]).state).toBe('waiting')
  })
})
