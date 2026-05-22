export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { delegationLogger } from '@/lib/logger'
import { withSpan } from '@/lib/tracing/tracer'
import { checkRateLimit, buildRateLimitHeaders } from '@/lib/rate-limit'
import { spawn, execSync } from 'child_process'
import type { Delegation, AgentLog, DelegationReport } from '@/lib/models/delegation'
import { registerProcess, unregisterProcess } from '@/lib/process-registry'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { postLinearCompletionComment } from '@/lib/connectors/linear-writeback'
import { createGitHubPRIfNeeded } from '@/lib/github/pr-creator'
import { upsertAttentionItem } from '@/lib/attention/store'
import {
  buildExecutionStartLog,
  buildSimulationBudgetLog,
  getExecutionStartBlocker,
  buildSubTaskPrompt,
  buildSkillBlock,
  buildRetryContext,
} from '@/lib/delegation-execution'
import { OllamaAgentRunner, isOllamaReachable } from '@/lib/agent-runner/ollama-runner'
import { budgetToClaudeCliMaxTurns, budgetToMaxTurns } from '@/lib/budget-utils'
import { scoreWork } from '@/lib/agents/work-quality'
import { recordOutcome } from '@/lib/agents/skill-evolver'
import { generateText } from '@/lib/ai/text-generation'
import { extractKnowledge } from '@/lib/knowledge/extraction'
import { persistGrokCriticForDelegation } from '@/lib/eval/auto-grok-critic'
import { writebackExecutionInsights, writebackDelegationKnowledge } from '@/lib/knowledge/writeback'
import { notifyExecutionResult, notifyBudgetWarning } from '@/lib/notifications'
import { checkBudget, wouldExceedBudget } from '@/lib/budget/guard'
import { triggerChain } from '@/lib/delegations/chaining'

import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { buildContextPackage } from '@/lib/knowledge/context-package'
import type { MemoryCard } from '@/lib/knowledge/types'
import { checkParallelCompletion } from '@/lib/delegation-parallel'

async function appendLogs(id: string, newLogs: AgentLog[], statusOverride?: Delegation['status'], report?: DelegationReport) {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const current = await repo.findById(id)
  if (!current) return
  await repo.update(id, {
    ...(statusOverride ? { status: statusOverride } : {}),
    ...(report ? { summaryReport: report } : {}),
    logs: [...(current.logs ?? []), ...newLogs],
  })
}

function buildPrompt(delegation: Delegation, contextCards?: MemoryCard[], retryContext?: string): string {
  const c = delegation.contract
  const slug = c.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const branch = `${c.branchStrategy}/${slug}-task`
  const commitPrefix = c.taskType || 'feat'
  const maxTurns = budgetToClaudeCliMaxTurns(c.maxBudgetUsd)
  const checkpointTurn = Math.max(10, Math.floor(maxTurns * 0.4))

  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map((d) => `- [ ] ${d}`)
    .join('\n') || '- [ ] Task erfolgreich abgeschlossen'

  const contextCardsBlock =
    contextCards && contextCards.length > 0
      ? `\n## Relevant Knowledge\n${contextCards.map(card => `- **${card.title}** (${card.type}): ${card.body}`).join('\n')}\n`
      : ''

  const context = c.context?.trim()
    ? `\n## Context\n${c.context.trim()}\n${contextCardsBlock}${retryContext ?? ''}`
    : `${contextCardsBlock}${retryContext ?? ''}`

  const skillBlock = buildSkillBlock(c.skillCategory, c.allowedFilePatterns)

  return `You are an autonomous software engineering agent working on **ForgePilot** — a local-first AI Workflow OS built with Next.js 14, TypeScript strict, Tailwind CSS, and Vitest.

## Task
${c.goal}
${context}
## Definition of Done (check each before creating PR)
${dod}

## Constraints
- Risk class: **${c.riskClass}** (A = safe/additive, B = modifies existing, C = needs human review)
- Branch: \`${branch}\`
- Max budget: $${c.maxBudgetUsd} (~${maxTurns} turns)
- Work item: ${c.workItemId}

## Execution protocol (follow exactly, in order)
\`\`\`
1. Read CLAUDE.md  →  understand conventions and project structure
2. git checkout -b ${branch}
3. Explore: read relevant source files before writing any code
4. Implement: small, focused changes — one concern per commit
5. Verify: npm run test:run && npm run lint && npm run type-check
   (run type-check BEFORE build — never in parallel)
6. Commit: git commit -m "${commitPrefix}: <description>"
7. PR: gh pr create --title "${commitPrefix}: ${c.goal.substring(0, 60).replace(/"/g, "'")}" --body "## Summary\\n- <bullets>\\n\\n## Test plan\\n- [ ] tests pass"
8. Final output: print DONE: <one-sentence summary>
\`\`\`

## Anti-drift rules (critical — read before each major action)
- **Stay in scope**: only modify files directly needed for this task. Touching unrelated files = scope drift.
- **No gold-plating**: implement exactly what the Definition of Done requires. Nothing more.
- **Turn checkpoint**: at turn ${checkpointTurn}, stop and re-read "## Task" and "## Definition of Done" above before continuing.
- **Progress signal every 10 turns**: print "PROGRESS: <what done> | <what next> | <turns used>/${maxTurns}"
- **Abort conditions** — stop immediately and print "ESCALATION: <reason>" if:
  - You've used more than 60% of turns without a commit
  - A step fails 3 times with the same error
  - The task requires touching Risk-C files and riskClass is A or B
  - You are unsure which of 2+ approaches to take

## Quality rules
- No \`any\` types. No unused imports. No comments stating the obvious.
- Tests must cover the new behavior — not just type-check.
- Never commit directly to main. Never force-push.
- If a step fails, diagnose root cause before retrying.
${skillBlock}
Start now.`
}

// buildSubTaskPrompt and buildSkillBlock are imported from @/lib/delegation-execution

type SkillCategory = NonNullable<import('@/lib/models/delegation').TaskContract['skillCategory']>

/**
 * Detect credit/auth errors in claude CLI output.
 * Returns a user-friendly message or undefined if no known error.
 */
function detectKnownError(output: string): string | undefined {
  const lower = output.toLowerCase()
  if (lower.includes('credit balance') || lower.includes('insufficient_quota') || lower.includes('billing')) {
    return 'Anthropic-Guthaben aufgebraucht. Bitte unter console.anthropic.com aufladen.'
  }
  if (lower.includes('authentication') || lower.includes('invalid x-api-key') || lower.includes('api_key')) {
    return 'Anthropic API Key ungültig oder nicht konfiguriert. Bitte in den Einstellungen prüfen.'
  }
  if (lower.includes('rate limit') || lower.includes('rate_limit')) {
    return 'Anthropic Rate Limit erreicht. Warte kurz und versuche es erneut.'
  }
  return undefined
}

/**
 * Parse actual cost from Claude CLI output.
 * Claude outputs something like: "Cost: $0.0234" or "Total cost: $0.01"
 */
function parseCostFromOutput(output: string): number | undefined {
  // Pattern: "Cost: $X.XXXX" or "Total cost: $X.XX" or "cost: $X"
  const patterns = [
    /total cost[:\s]+\$([0-9]+(?:\.[0-9]+)?)/i,
    /cost[:\s]+\$([0-9]+(?:\.[0-9]+)?)/i,
    /\$([0-9]+\.[0-9]{2,4})\s*(?:USD|usd)?(?:\s|$)/,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(output)
    if (match) {
      const val = parseFloat(match[1])
      if (!isNaN(val) && val > 0 && val < 100) return val
    }
  }
  return undefined
}

/**
 * Parse a GitHub PR URL from claude CLI output.
 * gh pr create prints the URL on its own line when successful.
 */
function parsePrUrlFromOutput(output: string): string | undefined {
  const match = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/i.exec(output)
  return match ? match[0] : undefined
}

/**
 * M217: Auto-merge PR for Risk A delegations.
 * Risk A = safe/additive → auto-merge when CI passes.
 * Risk B = modifies existing → manual review needed.
 * Risk C = blocked upstream at approval step.
 */
function autoMergePRIfEligible(prUrl: string, riskClass: string, delegationId: string): void {
  if (riskClass !== 'A') return
  try {
    const match = /\/pull\/(\d+)/.exec(prUrl)
    if (!match) return
    const prNumber = match[1]
    execSync(`gh pr merge ${prNumber} --auto --squash`, { timeout: 15000, stdio: 'ignore' })
    delegationLogger.info({ event: 'pr.auto_merge.enabled', prUrl, delegationId }, 'Auto-merge enabled for Risk A PR')
  } catch (err) {
    delegationLogger.warn({ event: 'pr.auto_merge.failed', error: String(err), prUrl, delegationId }, 'Auto-merge setup failed')
  }
}

function isClaudeAvailable(): boolean {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function runWithClaudeCLI(id: string, prompt: string, startTime: Date, budgetUsd: number, riskClass: string) {
  const storedKeys = readStoredApiKeys()
  const anthropicKey = storedKeys.ANTHROPIC_API_KEY?.trim() || undefined
  const maxTurns = budgetToClaudeCliMaxTurns(budgetUsd)

  // Strip ANTHROPIC_API_KEY from inherited env so Claude CLI uses its own
  // session auth (Max subscription). Only re-inject if a key is explicitly
  // configured via the Settings UI — that key takes precedence.
  const { ANTHROPIC_API_KEY: _stripped, ...baseEnv } = process.env
  // Ensure GH_TOKEN reaches the subprocess so agents can run `gh pr create`
  const ghToken = storedKeys.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()
  const childEnv = {
    ...baseEnv,
    ...(anthropicKey ? { ANTHROPIC_API_KEY: anthropicKey } : {}),
    ...(ghToken ? { GH_TOKEN: ghToken, GITHUB_TOKEN: ghToken } : {}),
  }

  const proc = spawn(
    'claude',
    ['-p', prompt, '--dangerously-skip-permissions', '--max-turns', String(maxTurns)],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv,
    },
  )
  proc.unref()

  // Register PID for cancellation
  if (proc.pid) {
    registerProcess(id, proc.pid)
  }

  const logBuffer: AgentLog[] = []
  let fullOutput = ''
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      if (logBuffer.length > 0) {
        appendLogs(id, [...logBuffer])
        logBuffer.length = 0
      }
    }, 2000)
  }

  proc.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    fullOutput += text
    const lines = text.split('\n').filter(l => l.trim())
    for (const line of lines) {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        type: line.startsWith('$') ? 'command' : 'info',
        message: line.substring(0, 500),
      })
    }
    scheduleFlush()
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    fullOutput += text
    const knownError = detectKnownError(text)
    const lines = text.split('\n').filter(l => l.trim())
    for (const line of lines) {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: line.substring(0, 500),
      })
    }
    if (knownError) {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `⚠️ ${knownError}`,
      })
    }
    scheduleFlush()
  })

  proc.on('close', (code: number | null) => {
    if (flushTimer) clearTimeout(flushTimer)
    unregisterProcess(id)

    const success = code === 0
    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000)
    const actualCost = parseCostFromOutput(fullOutput)
    const prUrl = parsePrUrlFromOutput(fullOutput)
    const knownError = !success ? detectKnownError(fullOutput) : undefined

    // M217: Auto-merge for Risk A
    if (success && prUrl) {
      autoMergePRIfEligible(prUrl, riskClass, id)
    }

    const autoMergeNote = success && prUrl
      ? riskClass === 'A'
        ? ' · Auto-Merge aktiviert (Risk A)'
        : riskClass === 'B'
          ? ' · PR bereit — Review erforderlich (Risk B)'
          : ''
      : ''

    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: success ? 'success' : 'error',
      message: success
        ? `✅ Ausführung abgeschlossen (Exit-Code: ${code}${actualCost ? `, Kosten: $${actualCost.toFixed(4)}` : ''}${autoMergeNote})`
        : knownError
          ? `❌ ${knownError}`
          : `❌ Ausführung fehlgeschlagen (Exit-Code: ${code})`,
    }

    const report: DelegationReport | undefined = success
      ? { keyPoints: ['Ausführung via Claude CLI abgeschlossen'], changes: [], timeTakenMinutes: elapsed, ...(prUrl ? { prUrl } : {}) }
      : undefined

    // Only update if still running (not already cancelled)
    void (async () => {
      const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
      const current = await repo.findById(id)
      if (!current || current.status !== 'running') return

      const finalStatus = success ? 'completed' : 'failed'
      const finishedDelegation = await repo.update(id, {
        status: finalStatus,
        completedAt: new Date().toISOString(),
        ...(actualCost ? { actualCostUsd: actualCost } : {}),
        ...(report ? { summaryReport: report } : {}),
        logs: [...(current.logs ?? []), ...logBuffer, finalLog],
      })
      if (!finishedDelegation) return

      // M209: Post-execution budget guard — mark failed if actual cost exceeded limit
      if (success && actualCost) {
        const budgetResult = await checkBudget(finishedDelegation)
        if (budgetResult.exceeded) {
          // Delegation already marked as failed by checkBudget — skip further processing
          return
        }
      }

      // M207: Fan-in — notify parent if this is a parallel sub-delegation
      void checkParallelCompletion(finishedDelegation)

      // M230: Delegation chaining — fire-and-forget, never blocks or fails the parent
      if (success) {
        void triggerChain(finishedDelegation, fullOutput).catch(() => {})
      }

      {

      // Record quality outcome in skill-history (feeds Performance tab)
      try {
        const skillCategory = (finishedDelegation.contract.skillCategory ?? 'refactor') as SkillCategory
        const warnings = finishedDelegation.summaryReport?.warnings ?? []
        const typeErrors = warnings.filter(w => w.toLowerCase().includes('type error') || w.toLowerCase().includes('typescript')).length
        const lintErrors = warnings.filter(w => w.toLowerCase().includes('lint')).length
        const filesChanged = (finishedDelegation.summaryReport?.filesModified?.length ?? 0)
          + (finishedDelegation.summaryReport?.filesAdded?.length ?? 0)
        const durationMinutes = finishedDelegation.summaryReport?.timeTakenMinutes ?? elapsed
        const testsPassed = (finishedDelegation.summaryReport?.testsPassed ?? 1) > 0

        const result = scoreWork({
          task: {
            id: finishedDelegation.id,
            title: finishedDelegation.title ?? finishedDelegation.contract.goal.slice(0, 60),
            description: finishedDelegation.contract.goal,
            acceptanceCriteria: finishedDelegation.contract.definitionOfDone ?? [],
            skillCategory,
            assignedAgentType: 'claude-code',
            filePatterns: finishedDelegation.contract.allowedFilePatterns ?? [],
            effort: 'M',
            dependsOn: [],
            order: 0,
          },
          // Use process exit success as primary quality signal
          testsPassed: success && testsPassed,
          typeErrorCount: typeErrors,
          lintErrorCount: lintErrors,
          filesChanged,
          retryCount: 0,
          durationMinutes,
        })
        recordOutcome('claude-code', skillCategory, result)
      } catch {
        // Non-critical — never break execution due to telemetry
      }

      // Linear writeback — fire-and-forget
      if (success && report) {
        postLinearCompletionComment(finishedDelegation).catch(() => {})
      }

      // M197: Auto-PR creation — fire-and-forget
      if (success) {
        void createGitHubPRIfNeeded(finishedDelegation, fullOutput).then(async (result) => {
          const prLog: AgentLog = {
            timestamp: new Date().toISOString(),
            type: result.prUrl ? 'success' : 'info',
            message: result.prUrl
              ? `🔗 GitHub PR bereit: ${result.prUrl}${result.reason === 'already_exists' ? ' (bereits vorhanden)' : ''}`
              : `⚠️ GitHub PR nicht erstellt: ${result.reason ?? 'unbekannter Grund'}`,
          }
          await appendLogs(finishedDelegation.id, [prLog])

          if (result.prUrl) {
            const prRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
            await prRepo.update(finishedDelegation.id, {
              summaryReport: {
                keyPoints: finishedDelegation.summaryReport?.keyPoints ?? [],
                changes: finishedDelegation.summaryReport?.changes ?? [],
                timeTakenMinutes: finishedDelegation.summaryReport?.timeTakenMinutes ?? 0,
                ...finishedDelegation.summaryReport,
                prUrl: result.prUrl,
              },
            })
          }
        })
      }

      // M116: Auto-Knowledge Extraction — fire-and-forget
      if (success) {
        extractKnowledge(finishedDelegation).catch(() => {
          // Non-critical — never block execution
        })
      }

      // M220: Knowledge Writeback — fire-and-forget
      if (success) {
        void writebackDelegationKnowledge(finishedDelegation, fullOutput).catch(() => {})
      }

      if (success && report) {
        persistGrokCriticForDelegation(finishedDelegation, report)
          .then(criticScore => {
            if (criticScore) {
              void writebackExecutionInsights({ ...finishedDelegation, criticScore })
            }
          })
          .catch(() => {})
      }

      // Completion attention item
      const label = finishedDelegation.title || finishedDelegation.contract.goal.slice(0, 60)
      upsertAttentionItem({
        id: `completion:${id}`,
        type: success ? 'delegation_completed' : 'delegation_failed',
        severity: success ? 'info' : 'critical',
        title: success ? `✅ Abgeschlossen: ${label}` : `❌ Fehlgeschlagen: ${label}`,
        body: success
          ? `Agent-Lauf abgeschlossen${report?.prUrl ? ` · PR: ${report.prUrl}` : ''}${actualCost ? ` · $${actualCost.toFixed(4)}` : ''}`
          : knownError ?? `Exit-Code: ${code}`,
        delegationId: id,
        actionUrl: `/delegations/${id}`,
        createdAt: new Date().toISOString(),
      })

      // M204: fire-and-forget execution notification
      void notifyExecutionResult({ delegation: finishedDelegation, event: finalStatus })

      // M255: budget warning when actual cost ≥ 80% of limit
      if (success && actualCost) {
        const maxBudget = finishedDelegation.contract.maxBudgetUsd
        if (maxBudget && maxBudget > 0) {
          void notifyBudgetWarning({
            delegation: finishedDelegation,
            actualCostUsd: actualCost,
            maxBudgetUsd: maxBudget,
            usagePct: actualCost / maxBudget,
          })
        }
      }
      }
    })()
  })
}

async function runWithOllamaAgent(
  id: string,
  prompt: string,
  startTime: Date,
  budgetUsd: number,
  model: string,
) {
  const maxTurns = budgetToMaxTurns(budgetUsd)
  const reachable = await isOllamaReachable()
  if (!reachable) {
    const errLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: '❌ Ollama nicht erreichbar (http://localhost:11434). Bitte `ollama serve` starten.',
    }
    await appendLogs(id, [errLog], 'failed')
    upsertAttentionItem({
      id: `completion:${id}`,
      type: 'delegation_failed',
      severity: 'critical',
      title: `❌ Ollama nicht erreichbar`,
      body: 'Bitte Ollama starten (ollama serve) und erneut versuchen.',
      delegationId: id,
      actionUrl: `/delegations/${id}`,
      createdAt: new Date().toISOString(),
    })
    return
  }

  const runner = new OllamaAgentRunner(id, model, process.cwd(), {
    onLog: logs => void appendLogs(id, logs),
  })

  try {
    const result = await runner.run(prompt, maxTurns)
    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000)
    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: result.success ? 'success' : 'error',
      message: result.success
        ? `✅ Ollama-Run abgeschlossen (${result.turns} Turns)`
        : `❌ Ollama-Run fehlgeschlagen nach ${result.turns} Turns`,
    }
    const report: DelegationReport | undefined = result.success
      ? {
          keyPoints: [`Ollama-Run abgeschlossen mit ${model}`, result.summary.slice(0, 200)],
          changes: [],
          timeTakenMinutes: elapsed,
          costSavings: result.costSavings,
        }
      : undefined

    await appendLogs(id, [finalLog], result.success ? 'completed' : 'failed', report)

    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const finished = await repo.findById(id)
    if (finished) {
      // M207: Fan-in — notify parent if this is a parallel sub-delegation
      void checkParallelCompletion(finished)

      // M230: Delegation chaining — fire-and-forget
      if (result.success) {
        void triggerChain(finished, result.summary).catch(() => {})
      }

      const label = finished.title || finished.contract.goal.slice(0, 60)
      const savedStr = result.costSavings.savedUsd > 0
        ? ` · 💰 $${result.costSavings.savedUsd.toFixed(4)} gespart`
        : ''
      const tokensStr = result.tokenUsage.totalTokens > 0
        ? ` · ${result.tokenUsage.totalTokens.toLocaleString()} Tokens`
        : ''
      upsertAttentionItem({
        id: `completion:${id}`,
        type: result.success ? 'delegation_completed' : 'delegation_failed',
        severity: result.success ? 'info' : 'critical',
        title: result.success ? `✅ Abgeschlossen: ${label}` : `❌ Fehlgeschlagen: ${label}`,
        body: result.success
          ? `Ollama-Run abgeschlossen · ${result.turns} Turns · ${model}${tokensStr}${savedStr}`
          : `Run nach ${result.turns} Turns abgebrochen`,
        delegationId: id,
        actionUrl: `/delegations/${id}`,
        createdAt: new Date().toISOString(),
      })

      // M204: fire-and-forget execution notification
      void notifyExecutionResult({ delegation: finished, event: result.success ? 'completed' : 'failed' })
    }
  } catch (err) {
    const msg = (err as Error).message
    const errLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `❌ Ollama-Runner-Fehler: ${msg}`,
    }
    await appendLogs(id, [errLog], 'failed')
  }
}

/**
 * Run via Claude API (generateText) when the claude CLI binary is unavailable.
 * Calls the real API to produce an execution plan + summary.
 * Not fully agentic (no tool-use loop), but produces genuine AI output
 * instead of a canned simulation.
 */
async function runWithClaudeAPI(id: string, delegation: Delegation, startTime: Date) {
  const goal = delegation.contract.goal
  const dod = (delegation.contract.definitionOfDone ?? []).map(d => `- ${d}`).join('\n') || '- Task erfolgreich abgeschlossen'

  const startLogEntry: AgentLog = {
    timestamp: new Date().toISOString(),
    type: 'info',
    message: '🤖 Claude API-Runner gestartet (kein CLI verfügbar — API-Modus)',
  }
  await appendLogs(id, [startLogEntry])

  try {
    const result = await generateText({
      system: `You are an expert software engineering agent working on ForgePilot — a Next.js 14, TypeScript strict, Tailwind CSS project.
Analyse the task, produce a concrete implementation plan with specific file changes, commands, and validation steps.
Be specific: name exact files, functions, and TypeScript types. Identify any risks or blockers.
End with a one-line DONE: <summary> statement.`,
      prompt: `## Task\n${goal}\n\n## Definition of Done\n${dod}\n\n## Context\n${delegation.contract.context ?? '(none)'}`,
      maxTokens: 1200,
      purpose: 'coding',
    })

    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000)
    const planLines = result.text.split('\n')

    // Log plan line-by-line for live visibility in the UI
    const planLogs: AgentLog[] = planLines
      .filter(l => l.trim())
      .map(line => ({
        timestamp: new Date().toISOString(),
        type: (line.startsWith('#') ? 'thought' : line.startsWith('$') ? 'command' : 'info') as AgentLog['type'],
        message: line.substring(0, 500),
      }))

    const doneLine = planLines.find(l => l.startsWith('DONE:'))
    const summaryText = doneLine ? doneLine.replace('DONE:', '').trim() : result.text.slice(0, 200)

    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'success',
      message: `✅ Claude API-Analyse abgeschlossen (${result.provider}/${result.model}${result.outputTokens ? `, ${result.outputTokens} Tokens` : ''})`,
    }

    const report: DelegationReport = {
      keyPoints: [summaryText, `Analysiert via ${result.provider}/${result.model}`],
      changes: [],
      timeTakenMinutes: elapsed,
    }

    await appendLogs(id, [...planLogs, finalLog], 'completed', report)

    const repoForLabel = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const finished = await repoForLabel.findById(id)
    const label = finished?.title || goal.slice(0, 60)
    upsertAttentionItem({
      id: `completion:${id}`,
      type: 'delegation_completed',
      severity: 'info',
      title: `✅ Analysiert: ${label}`,
      body: `Claude API Plan erstellt (${result.provider}) — kein CLI verfügbar, Implementierung manuell starten`,
      delegationId: id,
      actionUrl: `/delegations/${id}`,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const errLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `❌ Claude API-Runner-Fehler: ${msg}`,
    }
    await appendLogs(id, [errLog], 'failed')
    upsertAttentionItem({
      id: `completion:${id}`,
      type: 'delegation_failed',
      severity: 'critical',
      title: `❌ API-Runner fehlgeschlagen`,
      body: msg.slice(0, 200),
      delegationId: id,
      actionUrl: `/delegations/${id}`,
      createdAt: new Date().toISOString(),
    })
  }
}

function runSimulation(id: string, delegation: Delegation) {
  const goal = delegation.contract.goal
  const budgetLog = buildSimulationBudgetLog(delegation)

  const steps: Array<{ delay: number; type: AgentLog['type']; message: string }> = [
    { delay: 800,  type: 'info',    message: `📋 Task geladen: ${goal.substring(0, 80)}` },
    { delay: 1200, type: budgetLog.type, message: budgetLog.message },
    { delay: 1800, type: 'info',    message: '🔍 Analysiere Projektstruktur...' },
    { delay: 3000, type: 'command', message: `$ git checkout -b ${delegation.contract.branchStrategy}/${delegation.contract.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-task` },
    { delay: 4500, type: 'thought', message: '💭 Verstehe Anforderungen aus Definition of Done...' },
    { delay: 6000, type: 'info',    message: '📝 Implementierung läuft...' },
    { delay: 9000, type: 'command', message: '$ npm test -- --run' },
    { delay: 11000,type: 'success', message: '✓ Tests grün' },
    { delay: 12500,type: 'command', message: `$ git commit -m "${delegation.contract.taskType || 'feat'}: ${goal.substring(0, 50).replace(/"/g, "'")}"` },
    { delay: 13500,type: 'command', message: '$ gh pr create --title "..." --body "..."' },
    { delay: 14500,type: 'success', message: '✅ Simulation abgeschlossen — echte Ausführung startet sobald Anthropic-Guthaben verfügbar ist' },
  ]

  let totalDelay = 0
  for (const step of steps) {
    totalDelay += step.delay
    const isLast = step === steps[steps.length - 1]
    const capturedDelay = totalDelay
    const capturedStep = step

    setTimeout(() => {
      const log: AgentLog = {
        timestamp: new Date().toISOString(),
        type: capturedStep.type,
        message: capturedStep.message,
      }
      const report: DelegationReport | undefined = isLast
        ? {
            keyPoints: [goal, 'Simulations-Lauf abgeschlossen'],
            changes: delegation.contract.definitionOfDone ?? [],
            timeTakenMinutes: Math.round(capturedDelay / 60000),
          }
        : undefined
      void appendLogs(id, [log], isLast ? 'completed' : undefined, report)
    }, capturedDelay)
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  // Rate limit: 10 executions per minute per IP (AI calls are expensive)
  const rateCheck = checkRateLimit(_req, { limit: 10, windowSec: 60, keyPrefix: 'execute' })
  if (!rateCheck.allowed) {
    delegationLogger.warn({ event: 'delegation.execute.rate_limited', retryAfter: rateCheck.retryAfter })
    return NextResponse.json(
      { error: 'Too many requests. Please wait before executing another delegation.' },
      { status: 429, headers: buildRateLimitHeaders(rateCheck) },
    )
  }

  const { id } = await params

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const blocker = getExecutionStartBlocker(delegation)
  if (blocker) {
    return NextResponse.json({ error: blocker.error }, { status: blocker.status })
  }

  // M209: Pre-execution budget guard — reject before starting if estimate exceeds limit
  if (wouldExceedBudget(delegation, delegation.costEstimateUsd)) {
    return NextResponse.json(
      { error: `Estimated cost $${delegation.costEstimateUsd} exceeds budget limit $${delegation.contract.maxCostUsd}` },
      { status: 422 },
    )
  }

  // Auto-orchestrate: decompose into sub-tasks and run each sequentially
  if (delegation.autoOrchestrate) {
    const startLog = buildExecutionStartLog(delegation)
    await appendLogs(id, [startLog], 'running')

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

    // Create orchestrated run
    const orchRes = await fetch(`${baseUrl}/api/agents/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegationId: id,
        delegationTitle: delegation.title || delegation.contract.goal,
        goal: delegation.contract.goal,
        context: delegation.contract.context,
      }),
    })
    const { run } = await orchRes.json() as { run: { id: string } }

    // Fire-and-forget execution
    fetch(`${baseUrl}/api/agents/orchestrate/${run.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch((err: unknown) => {
      delegationLogger.error({ event: 'delegation.orchestrate_error', delegationId: id, error: String(err) }, 'Orchestration trigger failed')
    })

    return NextResponse.json({ started: true, mode: 'orchestrated', delegationId: id, runId: run.id })
  }

  // Immediately mark as running + record start time
  const startLog = buildExecutionStartLog(delegation)
  await appendLogs(id, [startLog], 'running')
  {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    await repo.update(id, { startedAt: new Date().toISOString() })
  }

  const startTime = new Date()

  // Build context package from knowledge cards — non-critical, never blocks execution
  let contextCards: MemoryCard[] | undefined
  try {
    const pkg = await buildContextPackage(delegation.contract.goal, {
      workItemId: delegation.contract.workItemId,
      delegationId: delegation.id,
      maxCards: 4,
    })
    if (pkg.cards.length > 0) {
      contextCards = pkg.cards
      delegationLogger.info({ event: 'context.package', cardCount: pkg.cards.length, tokenEstimate: pkg.tokenEstimate })
    }
  } catch {
    // Non-critical — never block execution
  }

  // Use focused sub-task prompt when this is part of an orchestrated run
  const retryContext = buildRetryContext(delegation)
  const prompt = delegation.contract.orchestratedRunId
    ? buildSubTaskPrompt(delegation)
    : buildPrompt(delegation, contextCards, retryContext || undefined)

  // OTel: trace execution start + routing decision
  const mode = delegation.executionRoute === 'ollama-agent'
    ? 'ollama-agent'
    : isClaudeAvailable()
      ? 'claude-cli'
      : readStoredApiKeys().ANTHROPIC_API_KEY?.trim()
        ? 'claude-api'
        : 'simulation'

  void withSpan('delegation.execute', {
    'delegation.id':          id,
    'delegation.mode':        mode,
    'delegation.riskClass':   delegation.contract.riskClass,
    'delegation.privacyMode': delegation.contract.privacyMode,
    'delegation.budget':      delegation.contract.maxBudgetUsd ?? 0,
  }, async () => Promise.resolve())

  if (mode === 'ollama-agent') {
    const model = delegation.contract.llmModel?.trim() || 'qwen2.5-coder:14b'
    void runWithOllamaAgent(id, prompt, startTime, delegation.contract.maxBudgetUsd, model)
    return NextResponse.json({ started: true, mode: 'ollama-agent', delegationId: id, model })
  }

  if (mode === 'claude-cli') {
    runWithClaudeCLI(id, prompt, startTime, delegation.contract.maxBudgetUsd, delegation.contract.riskClass)
    return NextResponse.json({ started: true, mode: 'claude-cli', delegationId: id })
  }

  // Fallback 1: Claude API (generateText) — real AI output, no tool-use loop
  if (mode === 'claude-api') {
    void runWithClaudeAPI(id, delegation, startTime)
    return NextResponse.json({ started: true, mode: 'claude-api', delegationId: id })
  }

  // Fallback 2: pure simulation (no API key, no CLI)
  runSimulation(id, delegation)
  return NextResponse.json({ started: true, mode: 'simulation', delegationId: id })
}
