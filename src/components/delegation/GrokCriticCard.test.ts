import { describe, it, expect } from 'vitest'
import { CRITIC_SCORE_VERDICT_STYLES, CRITIC_SCORE_VERDICT_LABELS } from './GrokCriticCard'
import type { CriticScore } from '@/lib/models/delegation'

describe('CRITIC_SCORE_VERDICT_STYLES', () => {
  it('uses green classes for approved', () => {
    const style = CRITIC_SCORE_VERDICT_STYLES['approved']
    expect(style).toContain('green')
  })

  it('uses yellow classes for needs-revision', () => {
    const style = CRITIC_SCORE_VERDICT_STYLES['needs-revision']
    expect(style).toContain('yellow')
  })

  it('uses red classes for rejected', () => {
    const style = CRITIC_SCORE_VERDICT_STYLES['rejected']
    expect(style).toContain('red')
  })

  it('covers all CriticScore verdict values', () => {
    const verdicts: CriticScore['verdict'][] = ['approved', 'needs-revision', 'rejected']
    for (const v of verdicts) {
      expect(CRITIC_SCORE_VERDICT_STYLES[v]).toBeTruthy()
    }
  })
})

describe('CRITIC_SCORE_VERDICT_LABELS', () => {
  it('returns a non-empty label for approved', () => {
    expect(CRITIC_SCORE_VERDICT_LABELS['approved']).toBeTruthy()
  })

  it('returns a non-empty label for needs-revision', () => {
    expect(CRITIC_SCORE_VERDICT_LABELS['needs-revision']).toBeTruthy()
  })

  it('returns a non-empty label for rejected', () => {
    expect(CRITIC_SCORE_VERDICT_LABELS['rejected']).toBeTruthy()
  })

  it('has distinct labels for each verdict', () => {
    const labels = Object.values(CRITIC_SCORE_VERDICT_LABELS)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })
})
