import type { AgentRun } from '@/lib/models/agent-run'

export interface RunSummaryMarkdown {
  markdown: string
  lessonProposal?: string
}

export function buildRunSummary(run: AgentRun, goal?: string): RunSummaryMarkdown {
  const status = run.status
  const duration = run.completedAt
    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null

  const lines: string[] = [
    `# Agent Run — ${run.id.slice(0, 8)}`,
    '',
    `**Status:** ${status}`,
    `**Model:** ${run.model}`,
    `**Delegation:** ${run.delegationId}`,
    `**Contract:** ${run.contractId}`,
    goal ? `**Goal:** ${goal}` : '',
    '',
    '## Metrics',
    '',
    `| Metric | Value |`,
    `|---|---|`,
    `| Started | ${run.startedAt} |`,
    run.completedAt ? `| Completed | ${run.completedAt} |` : '',
    duration !== null ? `| Duration | ${duration}s |` : '',
    `| Total Cost | $${run.totalCostUsd.toFixed(4)} |`,
    `| Input Tokens | ${run.tokenInput} |`,
    `| Output Tokens | ${run.tokenOutput} |`,
    run.prUrl ? `| PR | ${run.prUrl} |` : '',
    '',
  ].filter(l => l !== undefined)

  const toolCalls = run.traceEvents.filter(e => e.type === 'tool_call')
  const errors = run.traceEvents.filter(e => e.type === 'error')

  if (toolCalls.length > 0) {
    lines.push('## Tool Calls', '')
    const toolNames = toolCalls
      .map(e => String(e.data.tool ?? 'unknown'))
      .reduce<Record<string, number>>((acc, t) => ({ ...acc, [t]: (acc[t] ?? 0) + 1 }), {})
    for (const [tool, count] of Object.entries(toolNames)) {
      lines.push(`- \`${tool}\`: ${count}x`)
    }
    lines.push('')
  }

  if (run.resultSummary) {
    lines.push('## Result', '', run.resultSummary, '')
  }

  if (errors.length > 0) {
    lines.push('## Errors', '')
    for (const e of errors) {
      lines.push(`- ${e.timestamp}: ${String(e.data.message ?? 'unknown error')}`)
    }
    lines.push('')
  }

  const markdown = lines.join('\n')

  const lessonProposal = buildLessonProposal(run, errors.length)

  return { markdown, lessonProposal }
}

function buildLessonProposal(run: AgentRun, errorCount: number): string | undefined {
  if (run.status !== 'completed' && run.status !== 'failed') return undefined
  if (errorCount === 0 && run.status === 'completed') return undefined

  const lines = [
    `## Lesson / ADR Proposal`,
    '',
    `**Run:** ${run.id}`,
    `**Status:** ${run.status}`,
    `**Error count:** ${errorCount}`,
    '',
    '### What happened',
    run.errorMessage ?? 'Run did not complete successfully.',
    '',
    '### Suggested action',
    errorCount > 0
      ? '- Add a policy rule or guard for the detected failure pattern.'
      : '- Consider documenting this pattern as an ADR.',
    '',
  ]

  return lines.join('\n')
}
