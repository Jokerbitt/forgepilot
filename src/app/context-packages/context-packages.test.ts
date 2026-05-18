import { describe, it, expect } from 'vitest'
import type { ContextPackage } from '@/lib/context-packages/types'

function readinessTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'danger'
}

function tokenBarWidth(count: number, budget: number): number {
  return Math.min(100, Math.round((count / Math.max(budget, 1)) * 100))
}

const makePkg = (partial: Partial<ContextPackage> = {}): ContextPackage => ({
  id: 'pkg-1',
  workItemId: 'wi-1',
  title: 'ForgePilot Context',
  objective: 'Build the context package builder',
  privacyMode: 'hybrid',
  sources: [],
  memoryCardIds: [],
  content: '',
  tokenCount: 1200,
  tokenBudget: 4000,
  readinessScore: 75,
  blockers: [],
  createdAt: '2026-05-18T10:00:00Z',
  expiresAt: '2026-05-19T10:00:00Z',
  ...partial,
})

describe('Context Packages — display logic', () => {
  it('maps score >= 70 to success tone', () => {
    expect(readinessTone(80)).toBe('success')
    expect(readinessTone(70)).toBe('success')
  })

  it('maps score 40-69 to warning tone', () => {
    expect(readinessTone(50)).toBe('warning')
    expect(readinessTone(40)).toBe('warning')
  })

  it('maps score < 40 to danger tone', () => {
    expect(readinessTone(39)).toBe('danger')
    expect(readinessTone(0)).toBe('danger')
  })

  it('calculates token bar width as percentage', () => {
    expect(tokenBarWidth(2000, 4000)).toBe(50)
    expect(tokenBarWidth(4000, 4000)).toBe(100)
  })

  it('clamps token bar at 100% when over budget', () => {
    expect(tokenBarWidth(5000, 4000)).toBe(100)
  })

  it('handles zero budget without division error', () => {
    expect(tokenBarWidth(100, 0)).toBe(100)
  })
})
