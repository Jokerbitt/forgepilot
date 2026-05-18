import { describe, it, expect } from 'vitest'
import type { AgentRun } from '@/lib/models/agent-run'

function statusLabel(status: AgentRun['status']): string {
  if (status === 'queued') return 'Warteschlange'
  if (status === 'running') return 'Läuft'
  if (status === 'completed') return 'Abgeschlossen'
  if (status === 'failed') return 'Fehlgeschlagen'
  if (status === 'cancelled') return 'Abgebrochen'
  return status
}

function statusTone(status: AgentRun['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'warning'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function formatCost(usd: number): string {
  if (usd === 0) return '—'
  if (usd < 0.01) return `$${(usd * 100).toFixed(4)}¢`
  return `$${usd.toFixed(4)}`
}

function totalCost(runs: AgentRun[]): number {
  return runs.reduce((s, r) => s + r.totalCostUsd, 0)
}

const makeRun = (partial: Partial<AgentRun> = {}): AgentRun => ({
  id: 'run-1',
  delegationId: 'del-1',
  contractId: 'ct-1',
  status: 'completed',
  model: 'claude-opus-4-7',
  startedAt: '2026-05-18T10:00:00Z',
  totalCostUsd: 0,
  tokenInput: 0,
  tokenOutput: 0,
  traceEvents: [],
  ...partial,
})

describe('Agent Runs — display logic', () => {
  it('maps all status values to labels', () => {
    expect(statusLabel('queued')).toBe('Warteschlange')
    expect(statusLabel('running')).toBe('Läuft')
    expect(statusLabel('completed')).toBe('Abgeschlossen')
    expect(statusLabel('failed')).toBe('Fehlgeschlagen')
    expect(statusLabel('cancelled')).toBe('Abgebrochen')
  })

  it('maps status to correct tone', () => {
    expect(statusTone('completed')).toBe('success')
    expect(statusTone('running')).toBe('warning')
    expect(statusTone('failed')).toBe('danger')
    expect(statusTone('queued')).toBe('neutral')
    expect(statusTone('cancelled')).toBe('neutral')
  })

  it('formats zero cost as dash', () => {
    expect(formatCost(0)).toBe('—')
  })

  it('formats sub-cent costs with cent suffix', () => {
    const result = formatCost(0.0005)
    expect(result).toContain('¢')
  })

  it('formats regular costs in dollars', () => {
    const result = formatCost(1.23)
    expect(result).toMatch(/^\$/)
  })

  it('aggregates total cost across runs', () => {
    const runs = [
      makeRun({ totalCostUsd: 0.05 }),
      makeRun({ id: 'run-2', totalCostUsd: 0.10 }),
    ]
    expect(totalCost(runs)).toBeCloseTo(0.15)
  })

  it('handles empty runs list without errors', () => {
    expect(totalCost([])).toBe(0)
  })
})
