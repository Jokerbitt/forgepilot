export const dynamic = 'force-dynamic'
/**
 * Orchestrated Execution Endpoint
 *
 * Kicks off sequential execution of all sub-tasks in an OrchestratedRun:
 * 1. Creates a child delegation for each AtomicTask
 * 2. Executes each delegation via the existing execute route
 * 3. Validates each result with the quality scorer
 * 4. Records outcome → skill evolver learns
 * 5. Stops on failure unless skipFailed=true
 */

import { NextResponse } from 'next/server'
import { getRun, setTaskAgentId, updateTaskStatus, updateRunStatus, retryTask, canRetry } from '@/lib/agents/orchestrated-run'
import { scoreWork } from '@/lib/agents/work-quality'
import { recordOutcome } from '@/lib/agents/skill-evolver'
import { upsertCard } from '@/lib/knowledge/store'
import { saveNotification } from '@/lib/notifications/notification-store'
import { updateIdeaHistoryStatus } from '@/lib/pilot/idea-history-store'
import { orchestrationLogger } from '@/lib/logger'
import crypto from 'crypto'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

function buildInternalHeaders(req: Request, includeJson = false): HeadersInit {
  const headers: Record<string, string> = includeJson ? { 'Content-Type': 'application/json' } : {}
  const apiKey = process.env.FORGEPILOT_API_KEY
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
    return headers
  }
  const cookie = req.headers.get('cookie')
  if (cookie) headers.Cookie = cookie
  return headers
}

export async function POST(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const run = getRun(runId)
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status === 'running') {
    return NextResponse.json({ error: 'Run already executing' }, { status: 409 })
  }

  const { skipFailed = false } = await req.json().catch(() => ({})) as { skipFailed?: boolean }

  updateRunStatus(runId, 'running')
  const jsonHeaders = buildInternalHeaders(req, true)
  const authHeaders = buildInternalHeaders(req)

  // Fire-and-forget — respond immediately, execution happens async
  executeRunAsync(runId, skipFailed, jsonHeaders, authHeaders).catch((err: unknown) => {
    orchestrationLogger.error({ event: 'orchestration.error', runId: runId, error: String(err) }, 'Async run failed')
  })

  return NextResponse.json({ started: true, runId: runId })
}

async function executeRunAsync(
  runId: string,
  skipFailed: boolean,
  jsonHeaders: HeadersInit,
  authHeaders: HeadersInit,
): Promise<void> {
  const run = getRun(runId)
  if (!run) return

  const pendingTasks = run.tasks.filter(t => t.status === 'pending')

  for (const entry of pendingTasks) {
    const task = entry.task
    const startedAt = Date.now()

    // Mark task running
    updateTaskStatus(runId, task.id, 'running')

    try {
      // 1. Create child delegation for this sub-task
      const childDelegationId = crypto.randomUUID()
      const delegationPayload = {
        id: childDelegationId,
        title: task.title,
        status: 'approved',
        contract: {
          id: crypto.randomUUID(),
          workItemId: `orch-${runId.slice(-6)}`,
          goal: `${task.title}\n\nDescription: ${task.description}\n\nAcceptance Criteria:\n${task.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`,
          context: `Part of orchestrated run ${runId}. Skill: ${task.skillCategory}. Patterns: ${task.filePatterns.join(', ')}`,
          branchStrategy: 'feature' as const,
          requiresApproval: false,
          privacyMode: 'private-cloud',
          outputMode: 'text',
          riskClass: 'A',
          maxBudgetUsd: 2,
          allowedTools: [],
          definitionOfDone: task.acceptanceCriteria,
          skillCategory: task.skillCategory,
          allowedFilePatterns: task.filePatterns,
          orchestratedRunId: runId,
          createdAt: new Date().toISOString(),
        },
        executionRoute: 'local-agent',
        costEstimateUsd: 0,
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Save delegation
      await fetch(`${BASE_URL}/api/delegations`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(delegationPayload),
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`Child delegation create failed: ${res.status} ${body.slice(0, 200)}`)
        }
      })
      setTaskAgentId(runId, task.id, delegationPayload.id)

      // 2. Execute delegation
      await fetch(`${BASE_URL}/api/delegations/${delegationPayload.id}/execute`, {
        method: 'POST',
        headers: authHeaders,
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`Child delegation execute failed: ${res.status} ${body.slice(0, 200)}`)
        }
      })

      // 3. Poll for completion (max 10 min)
      const result = await pollDelegationCompletion(delegationPayload.id, 600_000, authHeaders)

      const durationMinutes = Math.round((Date.now() - startedAt) / 60_000)

      // 4. Score the work
      const qualityResult = scoreWork({
        task,
        testsPassed: result.testsPassed,
        typeErrorCount: result.typeErrorCount,
        lintErrorCount: result.lintErrorCount,
        filesChanged: result.filesChanged,
        retryCount: entry.retryCount,
        durationMinutes,
      })

      // 5. Record for skill evolution
      recordOutcome(entry.agentType, task.skillCategory, qualityResult)

      // 6. Mark task done or failed + auto-retry on grade F
      const taskStatus = qualityResult.grade === 'F' ? 'failed' : 'done'
      updateTaskStatus(runId, task.id, taskStatus, qualityResult)

      if (taskStatus === 'failed') {
        if (canRetry(runId, task.id)) {
          retryTask(runId, task.id)
          // Re-add to pending queue by pushing back into loop
          pendingTasks.push(entry)
          continue
        }
        if (!skipFailed) {
          updateRunStatus(runId, 'failed')
          return
        }
      }
    } catch {
      updateTaskStatus(runId, task.id, 'failed')
      if (canRetry(runId, task.id)) {
        retryTask(runId, task.id)
        pendingTasks.push(entry)
        continue
      }
      if (!skipFailed) {
        updateRunStatus(runId, 'failed')
        return
      }
    }
  }

  // All tasks processed — write summary knowledge card + inbox notification + history status
  writeRunKnowledgeCard(runId)
  notifyRunComplete(runId)
  syncIdeaHistoryStatus(runId)
}

/** Write a MemoryCard summarising this run's outcomes to the Knowledge Store */
function writeRunKnowledgeCard(runId: string): void {
  try {
    const run = getRun(runId)
    if (!run || run.status !== 'done') return

    const doneTasks = run.tasks.filter(t => t.status === 'done')
    const failedTasks = run.tasks.filter(t => t.status === 'failed')
    const scores = doneTasks.map(t => t.result?.qualityScore ?? 0).filter(s => s > 0)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    const gradeMap = { A: '🟢', B: '🔵', C: '🟡', D: '🟠', F: '🔴' }

    const taskLines = run.tasks.map(t => {
      const grade = t.result?.grade ?? '—'
      const icon = gradeMap[grade as keyof typeof gradeMap] ?? '—'
      const score = t.result?.qualityScore != null ? ` (${t.result.qualityScore})` : ''
      return `- ${icon} ${t.task.title} [${t.task.skillCategory}]${score}`
    })

    const body = [
      `Orchestration run completed: ${run.delegationTitle}`,
      `Tasks: ${doneTasks.length} done, ${failedTasks.length} failed`,
      avgScore != null ? `Average quality score: ${avgScore}` : null,
      '',
      'Sub-tasks:',
      ...taskLines,
    ].filter(Boolean).join('\n')

    const now = new Date().toISOString()
    upsertCard({
      id: `orch-run-${runId}`,
      type: 'learning',
      title: `Orchestration: ${run.delegationTitle.slice(0, 60)}`,
      body,
      sourceIds: [],
      tags: ['orchestration', 'agent-run', avgScore != null && avgScore >= 80 ? 'high-quality' : 'review'],
      privacyClass: 'internal',
      confidence: avgScore != null && avgScore >= 75 ? 'high' : 'medium',
      createdAt: now,
      updatedAt: now,
    })
  } catch {
    // Non-fatal — knowledge writeback should never break execution
  }
}

async function pollDelegationCompletion(
  delegationId: string,
  timeoutMs: number,
  authHeaders: HeadersInit,
): Promise<{ testsPassed: boolean; typeErrorCount: number; lintErrorCount: number; filesChanged: number }> {
  const deadline = Date.now() + timeoutMs
  const pollInterval = 5_000

  while (Date.now() < deadline) {
    await sleep(pollInterval)
    try {
      const res = await fetch(`${BASE_URL}/api/delegations/${delegationId}`, { headers: authHeaders })
      if (!res.ok) continue
      const d = await res.json() as { status: string; summaryReport?: { filesModified?: string[]; filesAdded?: string[]; testsPassed?: number; warnings?: string[] } }

      if (d.status === 'completed') {
        const report = d.summaryReport ?? {}
        const filesChanged = (report.filesModified?.length ?? 0) + (report.filesAdded?.length ?? 0)
        // Extract quality signals from report warnings
        const warnings = report.warnings ?? []
        const typeErrors = warnings.filter(w => w.toLowerCase().includes('typescript') || w.toLowerCase().includes('type error')).length
        const lintErrors = warnings.filter(w => w.toLowerCase().includes('lint')).length
        return {
          testsPassed: (report.testsPassed ?? 1) > 0,
          typeErrorCount: typeErrors,
          lintErrorCount: lintErrors,
          filesChanged,
        }
      }

      if (d.status === 'failed' || d.status === 'cancelled') {
        return { testsPassed: false, typeErrorCount: 1, lintErrorCount: 0, filesChanged: 0 }
      }
    } catch {
      // continue polling
    }
  }

  // Timeout — mark as failed
  return { testsPassed: false, typeErrorCount: 0, lintErrorCount: 0, filesChanged: 0 }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Sync idea-history entry status when a run completes */
function syncIdeaHistoryStatus(runId: string): void {
  try {
    const run = getRun(runId)
    if (!run) return
    if (run.status === 'done') {
      updateIdeaHistoryStatus(runId, 'done')
    } else if (run.status === 'failed' || run.status === 'aborted') {
      updateIdeaHistoryStatus(runId, 'failed')
    }
  } catch {
    // Non-critical
  }
}

/** Fire an inbox notification when a run reaches a terminal state */
function notifyRunComplete(runId: string): void {
  try {
    const run = getRun(runId)
    if (!run) return

    const isDone = run.status === 'done'
    const isFailed = run.status === 'failed' || run.status === 'aborted'
    if (!isDone && !isFailed) return

    const doneTasks  = run.tasks.filter(t => t.status === 'done').length
    const totalTasks = run.tasks.length
    const scores     = run.tasks.map(t => t.result?.qualityScore ?? 0).filter(s => s > 0)
    const avgScore   = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null

    const title = isDone
      ? `Run abgeschlossen: ${run.delegationTitle}`
      : `Run fehlgeschlagen: ${run.delegationTitle}`

    const body = isDone
      ? `${doneTasks}/${totalTasks} Tasks erledigt${avgScore !== null ? ` · Ø ${avgScore} Punkte` : ''}`
      : `${doneTasks}/${totalTasks} Tasks erfolgreich — Run abgebrochen`

    saveNotification({
      id: crypto.randomUUID(),
      type: isDone ? 'orchestration-complete' : 'orchestration-failed',
      severity: isDone ? 'info' : 'warning',
      title,
      body,
      link: '/orchestrations',
      sourceId: runId,
      read: false,
      createdAt: new Date().toISOString(),
    })
  } catch {
    // Non-critical — never throw from notification logic
  }
}
