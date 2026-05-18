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
import { getRun, updateTaskStatus, updateRunStatus } from '@/lib/agents/orchestrated-run'
import { scoreWork } from '@/lib/agents/work-quality'
import { recordOutcome } from '@/lib/agents/skill-evolver'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

export async function POST(req: Request, { params }: { params: { runId: string } }) {
  const run = getRun(params.runId)
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status === 'running') {
    return NextResponse.json({ error: 'Run already executing' }, { status: 409 })
  }

  const { skipFailed = false } = await req.json().catch(() => ({})) as { skipFailed?: boolean }

  updateRunStatus(params.runId, 'running')

  // Fire-and-forget — respond immediately, execution happens async
  executeRunAsync(params.runId, skipFailed).catch(console.error)

  return NextResponse.json({ started: true, runId: params.runId })
}

async function executeRunAsync(runId: string, skipFailed: boolean): Promise<void> {
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
      const delegationPayload = {
        id: `orch-${runId.slice(-6)}-${task.id.slice(-6)}`,
        title: task.title,
        status: 'approved',
        contract: {
          id: `contract-orch-${task.id.slice(-6)}`,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delegationPayload),
      })

      // 2. Execute delegation
      await fetch(`${BASE_URL}/api/delegations/${delegationPayload.id}/execute`, {
        method: 'POST',
      })

      // 3. Poll for completion (max 10 min)
      const result = await pollDelegationCompletion(delegationPayload.id, 600_000)

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

      // 6. Mark task done
      const taskStatus = qualityResult.grade === 'F' ? 'failed' : 'done'
      updateTaskStatus(runId, task.id, taskStatus, qualityResult)

      if (taskStatus === 'failed' && !skipFailed) {
        updateRunStatus(runId, 'failed')
        return
      }
    } catch {
      updateTaskStatus(runId, task.id, 'failed')
      if (!skipFailed) {
        updateRunStatus(runId, 'failed')
        return
      }
    }
  }
}

async function pollDelegationCompletion(
  delegationId: string,
  timeoutMs: number,
): Promise<{ testsPassed: boolean; typeErrorCount: number; lintErrorCount: number; filesChanged: number }> {
  const deadline = Date.now() + timeoutMs
  const pollInterval = 5_000

  while (Date.now() < deadline) {
    await sleep(pollInterval)
    try {
      const res = await fetch(`${BASE_URL}/api/delegations/${delegationId}`)
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
