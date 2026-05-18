import { randomUUID } from 'crypto'
import type { PilotRunResult, PilotStep, PilotStepStatus } from './types'

export interface PilotInput {
  workItemId: string
  title: string
  goal: string
  privacyMode?: 'local-only' | 'hybrid' | 'cloud-approved'
  riskClass?: 'A' | 'B' | 'C'
  maxBudgetUsd?: number
}

type StepFn = () => Promise<unknown>

async function runStep(name: string, fn: StepFn): Promise<PilotStep> {
  const start = Date.now()
  try {
    const output = await fn()
    return { step: name, status: 'ok', durationMs: Date.now() - start, output }
  } catch (err) {
    return {
      step: name,
      status: 'error',
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function runPilot(input: PilotInput): Promise<PilotRunResult> {
  const id = randomUUID()
  const startedAt = new Date().toISOString()
  const steps: PilotStep[] = []
  const privacyMode = input.privacyMode ?? 'hybrid'
  const riskClass = input.riskClass ?? 'A'

  // Step 1: Policy check — validate task contract
  const policyStep = await runStep('policy-check', async () => {
    const { evaluatePolicy } = await import('@/lib/policy/engine')
    const contract = {
      id: randomUUID(),
      workItemId: input.workItemId,
      goal: input.goal,
      context: '',
      definitionOfDone: ['Tests pass', 'PR created'],
      riskClass,
      maxBudgetUsd: input.maxBudgetUsd ?? 5,
      allowedTools: ['Bash', 'Read', 'Write', 'Edit'],
      branchStrategy: 'feature' as const,
      requiresApproval: riskClass === 'C',
      privacyMode: (privacyMode === 'local-only' ? 'local' : 'private-cloud') as import('@/lib/models/delegation').PrivacyMode,
      createdAt: startedAt,
    }
    const decision = evaluatePolicy(contract)
    if (decision.verdict === 'deny') {
      throw new Error(`Policy denied: ${decision.reason}`)
    }
    return { verdict: decision.verdict, violations: decision.violations.length }
  })
  steps.push(policyStep)
  if (policyStep.status === 'error') return buildResult(id, input, 'failed', steps, startedAt)

  // Step 2: Model routing — pick best model for this task
  const routingStep = await runStep('model-routing', async () => {
    const { routeTask } = await import('@/lib/model-router/router')
    const { saveDecision } = await import('@/lib/model-router/store')
    const decision = routeTask({
      taskId: input.workItemId,
      workload: 'coding',
      privacyMode,
    })
    saveDecision(decision)
    return {
      provider: decision.selectedProvider,
      model: decision.selectedModel,
      reason: decision.reason.slice(0, 80),
      requiresApproval: decision.requiresApproval,
    }
  })
  steps.push(routingStep)

  // Step 3: Agent selection — pick best agent for the workload
  const agentStep = await runStep('agent-selection', async () => {
    const { pickAgentForWorkload } = await import('@/lib/agents/registry')
    const agent = pickAgentForWorkload('coding', 'backend-engineer')
    if (!agent) throw new Error('No available agent for workload')
    return { agentId: agent.id, role: agent.role, autonomyLevel: agent.autonomyLevel }
  })
  steps.push(agentStep)

  // Step 4: Agent run trace — create a run record
  const runTraceStep = await runStep('agent-run-create', async () => {
    const { createRun } = await import('@/lib/agent-runs/store')
    const agentOutput = agentStep.output as { agentId: string } | undefined
    const routingOutput = routingStep.output as { model: string } | undefined
    const run = createRun(
      input.workItemId,
      `contract-${id}`,
      routingOutput?.model ?? 'claude-haiku-4-5',
    )
    return { runId: run.id, status: run.status }
  })
  steps.push(runTraceStep)

  // Step 5: Writeback summary — generate run summary
  const writebackStep = await runStep('writeback', async () => {
    const { buildRunSummary } = await import('@/lib/writeback/summary')
    const runOutput = runTraceStep.output as { runId: string } | undefined
    if (!runOutput?.runId) return { skipped: true }

    const { getRun, updateRun } = await import('@/lib/agent-runs/store')
    updateRun(runOutput.runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      resultSummary: `Pilot run for "${input.title}" completed via orchestrator.`,
    })
    const run = getRun(runOutput.runId)
    if (!run) return { skipped: true }
    const { markdown } = buildRunSummary(run, input.goal)
    return { markdownLength: markdown.length, hasContent: markdown.includes(input.title) }
  })
  steps.push(writebackStep)

  const anyError = steps.some(s => s.status === 'error')
  const runOutput = runTraceStep.output as { runId?: string } | undefined
  const result = buildResult(id, input, anyError ? 'failed' : 'completed', steps, startedAt)
  return runOutput?.runId ? { ...result, agentRunId: runOutput.runId } : result
}

function buildResult(
  id: string,
  input: PilotInput,
  status: PilotRunResult['status'],
  steps: PilotStep[],
  startedAt: string,
): PilotRunResult {
  const completedAt = new Date().toISOString()
  const totalDurationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  return {
    id,
    workItemId: input.workItemId,
    title: input.title,
    status,
    steps,
    totalDurationMs,
    startedAt,
    completedAt,
  }
}
