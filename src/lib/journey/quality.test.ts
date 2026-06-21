import { describe, it, expect } from 'vitest'
import { humanizeQuality, type QualityInput } from './quality'

describe('humanizeQuality', () => {
  it('celebrates when all steps passed and averages the score', () => {
    const items: QualityInput[] = [
      { title: 'A', verdict: 'passed', score: 90 },
      { title: 'B', verdict: 'passed', score: 94 },
    ]
    const r = humanizeQuality(items)
    expect(r.allPassed).toBe(true)
    expect(r.averageScore).toBe(92)
    expect(r.headline).toMatch(/alle 2 Schritte|Alle 2 Schritte/i)
    expect(r.headline).toMatch(/92/)
  })

  it('reports a partial pass count', () => {
    const r = humanizeQuality([
      { title: 'A', verdict: 'passed', score: 80 },
      { title: 'B', verdict: 'failed', score: 30 },
    ])
    expect(r.allPassed).toBe(false)
    expect(r.headline).toMatch(/1 von 2/)
    expect(r.lines.some(l => l.includes('❌'))).toBe(true)
  })

  it('ignores steps without a verdict', () => {
    const r = humanizeQuality([{ title: 'A' }, { title: 'B', verdict: 'passed', score: 100 }])
    expect(r.checkedCount).toBe(1)
  })

  it('handles no checked steps', () => {
    expect(humanizeQuality([{ title: 'A' }]).headline).toMatch(/Noch keine/)
  })
})
