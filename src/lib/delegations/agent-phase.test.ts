import { describe, it, expect } from 'vitest'
import { inferAgentPhase } from './agent-phase'
import type { Delegation, AgentLog } from '@/lib/models/delegation'

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'd-1',
    workItemId: 'w-1',
    title: 'Test delegation',
    status: 'running',
    logs: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Delegation
}

function makeLog(message: string, type: AgentLog['type'] = 'info'): AgentLog {
  return { message, type, timestamp: new Date().toISOString() }
}

describe('inferAgentPhase — terminal statuses', () => {
  it('returns failed phase for failed delegation', () => {
    const d = makeDelegation({ status: 'failed', errorMessage: 'Something went wrong' })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('failed')
    expect(info.needsAttention).toBe(true)
    expect(info.attentionReason).toBe('Something went wrong')
  })

  it('failed phase uses default message when no errorMessage', () => {
    const d = makeDelegation({ status: 'failed' })
    const info = inferAgentPhase(d)
    expect(info.attentionReason).toBe('Delegation fehlgeschlagen')
  })

  it('returns done phase for completed delegation', () => {
    const d = makeDelegation({ status: 'completed' })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('done')
    expect(info.needsAttention).toBe(false)
  })

  it('extracts prUrl from completed delegation logs', () => {
    const d = makeDelegation({
      status: 'completed',
      logs: [makeLog('PR created: https://github.com/org/repo/pull/42')],
    })
    const info = inferAgentPhase(d)
    expect(info.prUrl).toBe('https://github.com/org/repo/pull/42')
  })

  it('returns starting phase for non-running status', () => {
    const d = makeDelegation({ status: 'pending' })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('starting')
  })

  it('returns starting phase for approved status', () => {
    const d = makeDelegation({ status: 'approved' })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('starting')
  })
})

describe('inferAgentPhase — running phase detection', () => {
  it('defaults to exploring when no signals', () => {
    const d = makeDelegation({ status: 'running', logs: [] })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('exploring')
  })

  it('detects implementing from write_file command', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('write_file: src/foo.ts created', 'command')],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('implementing')
  })

  it('detects implementing from edit_file in log', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('Using edit_file to update component')],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('implementing')
  })

  it('detects testing from npm test', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [
        makeLog('edit_file: updated code'),
        makeLog('npm run test:run'),
      ],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('testing')
  })

  it('detects testing from vitest', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('Running vitest in watch mode')],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('testing')
  })

  it('detects committing from git commit', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [
        makeLog('edit_file done'),
        makeLog('git commit -m "feat: add feature"'),
      ],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('committing')
  })

  it('detects pr_created from PR URL in log', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('Created PR at https://github.com/org/repo/pull/123')],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('pr_created')
    expect(info.prUrl).toBe('https://github.com/org/repo/pull/123')
  })

  it('detects pr_created from gh pr create command', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('gh pr create --title "feat" --body "desc"')],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('pr_created')
  })

  it('detects escalation from ESCALATION: signal', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('ESCALATION: Cannot determine correct approach')],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('escalation')
    expect(info.needsAttention).toBe(true)
    expect(info.attentionReason).toBe('Cannot determine correct approach')
  })

  it('detects done from DONE: signal', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [
        makeLog('edit_file done'),
        makeLog('DONE: Feature implemented and PR created'),
      ],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('done')
    expect(info.needsAttention).toBe(false)
  })

  it('DONE clears escalation state', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [
        makeLog('ESCALATION: Unclear'),
        makeLog('DONE: Resolved'),
      ],
    })
    const info = inferAgentPhase(d)
    expect(info.phase).toBe('done')
    expect(info.needsAttention).toBe(false)
  })
})

describe('inferAgentPhase — PROGRESS signal', () => {
  it('extracts progressSignal from PROGRESS: log', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('PROGRESS: files read | implementing auth | 3/20 turns')],
    })
    const info = inferAgentPhase(d)
    expect(info.progressSignal).toBe('files read | implementing auth | 3/20 turns')
  })

  it('extracts turnsUsed and maxTurns from PROGRESS signal', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('PROGRESS: exploring done | writing code | 7/30 turns')],
    })
    const info = inferAgentPhase(d)
    expect(info.turnsUsed).toBe(7)
    expect(info.maxTurns).toBe(30)
  })

  it('uses last PROGRESS signal when multiple present', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [
        makeLog('PROGRESS: step 1 done | next | 2/20 turns'),
        makeLog('PROGRESS: step 2 done | next | 8/20 turns'),
      ],
    })
    const info = inferAgentPhase(d)
    expect(info.turnsUsed).toBe(8)
    expect(info.progressSignal).toContain('8/20')
  })
})

describe('inferAgentPhase — error tracking', () => {
  it('flags needsAttention after 3 consecutive errors', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [
        makeLog('Command failed', 'error'),
        makeLog('Command failed again', 'error'),
        makeLog('Still failing', 'error'),
      ],
    })
    const info = inferAgentPhase(d)
    expect(info.needsAttention).toBe(true)
    expect(info.attentionReason).toContain('Wiederholende Fehler')
  })

  it('resets error count after non-error log', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [
        makeLog('Error 1', 'error'),
        makeLog('Error 2', 'error'),
        makeLog('Success', 'info'),
        makeLog('Error 3', 'error'),
        makeLog('Error 4', 'error'),
      ],
    })
    const info = inferAgentPhase(d)
    expect(info.needsAttention).toBe(false)
  })

  it('does not flag attention for exactly 2 consecutive errors', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [
        makeLog('Error 1', 'error'),
        makeLog('Error 2', 'error'),
      ],
    })
    const info = inferAgentPhase(d)
    expect(info.needsAttention).toBe(false)
  })
})

describe('inferAgentPhase — labels and emojis', () => {
  it('returns correct label and emoji for each phase', () => {
    const cases: Array<{ status: string; log?: string; expectedPhase: string; expectedEmoji: string }> = [
      { status: 'pending', expectedPhase: 'starting', expectedEmoji: '🚀' },
      { status: 'running', expectedPhase: 'exploring', expectedEmoji: '🔍' },
    ]

    for (const { status, expectedPhase, expectedEmoji } of cases) {
      const d = makeDelegation({ status: status as Delegation['status'] })
      const info = inferAgentPhase(d)
      expect(info.phase).toBe(expectedPhase)
      expect(info.emoji).toBe(expectedEmoji)
    }
  })

  it('failed phase has correct label', () => {
    const info = inferAgentPhase(makeDelegation({ status: 'failed' }))
    expect(info.label).toBe('Fehlgeschlagen')
    expect(info.emoji).toBe('❌')
  })

  it('escalation phase has correct label', () => {
    const d = makeDelegation({
      status: 'running',
      logs: [makeLog('ESCALATION: something wrong')],
    })
    const info = inferAgentPhase(d)
    expect(info.label).toBe('ESKALATION')
    expect(info.emoji).toBe('🚨')
  })
})
