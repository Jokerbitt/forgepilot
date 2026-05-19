import { describe, it, expect } from 'vitest'
import { analyzeDrift } from './drift-detector'
import type { AgentLog } from '@/lib/models/delegation'

function log(message: string, type: AgentLog['type'] = 'info', minutesAgo = 0): AgentLog {
  const ts = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()
  return { timestamp: ts, type, message }
}

describe('analyzeDrift', () => {
  it('returns no drift for a clean short run', () => {
    const logs = [
      log('Starting task', 'info'),
      log('PROGRESS: read files | implement feature | 3/15', 'info'),
      log('feat: add feature', 'info'),
    ]
    const result = analyzeDrift(logs, 15)
    expect(result.hasDrift).toBe(false)
    expect(result.driftScore).toBeLessThan(15)
    expect(result.signals).toHaveLength(0)
  })

  it('detects missing commit at 60%+ budget consumed', () => {
    // Simulate 10 info logs (>60% of maxTurns=15) with no commit
    const logs = Array.from({ length: 10 }, (_, i) => log(`Step ${i}`, 'info'))
    const result = analyzeDrift(logs, 15)

    const noCommit = result.signals.find(s => s.type === 'no_commit_mid_run')
    expect(noCommit).toBeDefined()
    expect(noCommit?.severity).toBe('critical')
  })

  it('detects ESCALATION signal in logs', () => {
    const logs = [
      log('Starting task'),
      log('ESCALATION: unclear which approach to use — A or B?', 'error'),
    ]
    const result = analyzeDrift(logs, 20)

    const esc = result.signals.find(s => s.type === 'escalation_detected')
    expect(esc).toBeDefined()
    expect(esc?.severity).toBe('critical')
    expect(result.hasDrift).toBe(true)
  })

  it('detects repeated errors', () => {
    const logs = [
      log('cannot find module xyz', 'error'),
      log('cannot find module xyz', 'error'),
      log('cannot find module xyz', 'error'),
    ]
    const result = analyzeDrift(logs, 20)

    const repeated = result.signals.find(s => s.type === 'repeated_error')
    expect(repeated).toBeDefined()
    expect(repeated?.severity).toBe('warning')
  })

  it('detects stall when last log is >5 minutes ago', () => {
    const logs = [
      log('Starting', 'info', 10),  // 10 minutes ago
      log('Working', 'info', 8),
      log('Still working', 'info', 6),
    ]
    const result = analyzeDrift(logs, 20)

    const stall = result.signals.find(s => s.type === 'stalled')
    expect(stall).toBeDefined()
  })

  it('gives high recommendation score for multiple critical signals', () => {
    const logs = [
      ...Array.from({ length: 12 }, (_, i) => log(`Step ${i}`, 'info')),
      log('ESCALATION: blocked by type error', 'error'),
      log('type error again', 'error'),
      log('type error again', 'error'),
      log('type error again', 'error'),
    ]
    const result = analyzeDrift(logs, 15)

    expect(result.driftScore).toBeGreaterThanOrEqual(35)
    expect(result.recommendation).toContain('stoppen')
  })

  it('returns correct lastCommitAt when commit log is present', () => {
    const commitTime = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const logs = [
      log('Starting', 'info'),
      { timestamp: commitTime, type: 'info' as const, message: 'feat: add new helper function' },
      log('PROGRESS: done | verify | 8/15'),
    ]
    const result = analyzeDrift(logs, 15)

    expect(result.lastCommitAt).toBe(commitTime)
  })
})
