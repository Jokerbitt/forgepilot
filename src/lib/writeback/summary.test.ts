import { describe, it, expect } from 'vitest'
import type { AgentRun } from '@/lib/models/agent-run'
import { buildRunSummary } from './summary'

function run(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 'run-abc123-def456',
    delegationId: 'del-1',
    contractId: 'con-1',
    status: 'completed',
    model: 'claude-haiku-4-5',
    startedAt: '2026-05-18T01:00:00Z',
    completedAt: '2026-05-18T01:05:30Z',
    totalCostUsd: 0.012,
    tokenInput: 1000,
    tokenOutput: 200,
    traceEvents: [],
    ...overrides,
  }
}

describe('buildRunSummary', () => {
  it('includes run id, model and status in markdown', () => {
    const { markdown } = buildRunSummary(run())
    expect(markdown).toContain('run-abc1')
    expect(markdown).toContain('claude-haiku-4-5')
    expect(markdown).toContain('completed')
  })

  it('includes cost and token metrics', () => {
    const { markdown } = buildRunSummary(run())
    expect(markdown).toContain('$0.0120')
    expect(markdown).toContain('1000')
    expect(markdown).toContain('200')
  })

  it('includes goal when provided', () => {
    const { markdown } = buildRunSummary(run(), 'Implement feature X')
    expect(markdown).toContain('Implement feature X')
  })

  it('includes tool call summary when traceEvents present', () => {
    const { markdown } = buildRunSummary(run({
      traceEvents: [
        { id: 'e1', agentRunId: 'run-1', type: 'tool_call', timestamp: '2026-05-18T01:01:00Z', data: { tool: 'Bash' } },
        { id: 'e2', agentRunId: 'run-1', type: 'tool_call', timestamp: '2026-05-18T01:02:00Z', data: { tool: 'Read' } },
        { id: 'e3', agentRunId: 'run-1', type: 'tool_call', timestamp: '2026-05-18T01:03:00Z', data: { tool: 'Bash' } },
      ],
    }))
    expect(markdown).toContain('`Bash`: 2x')
    expect(markdown).toContain('`Read`: 1x')
  })

  it('includes error section when errors present', () => {
    const { markdown } = buildRunSummary(run({
      traceEvents: [
        { id: 'e1', agentRunId: 'run-1', type: 'error', timestamp: '2026-05-18T01:01:00Z', data: { message: 'Command failed' } },
      ],
    }))
    expect(markdown).toContain('Errors')
    expect(markdown).toContain('Command failed')
  })

  it('returns no lessonProposal for clean completed run', () => {
    const { lessonProposal } = buildRunSummary(run())
    expect(lessonProposal).toBeUndefined()
  })

  it('returns lessonProposal for failed run', () => {
    const { lessonProposal } = buildRunSummary(run({
      status: 'failed',
      errorMessage: 'Build failed with exit code 1',
      traceEvents: [
        { id: 'e1', agentRunId: 'run-1', type: 'error', timestamp: '2026-05-18T01:01:00Z', data: { message: 'Build failed' } },
      ],
    }))
    expect(lessonProposal).toBeTruthy()
    expect(lessonProposal).toContain('failed')
    expect(lessonProposal).toContain('Build failed with exit code 1')
  })

  it('includes prUrl when available', () => {
    const { markdown } = buildRunSummary(run({ prUrl: 'https://github.com/org/repo/pull/42' }))
    expect(markdown).toContain('https://github.com/org/repo/pull/42')
  })
})
