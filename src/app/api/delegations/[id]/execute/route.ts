import { NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { Delegation, AgentLog, DelegationReport } from '@/lib/models/delegation'
import { registerProcess, unregisterProcess } from '@/lib/process-registry'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { postLinearCompletionComment } from '@/lib/connectors/linear-writeback'
import { upsertAttentionItem } from '@/lib/attention/store'
import {
  buildExecutionStartLog,
  buildSimulationBudgetLog,
  getExecutionStartBlocker,
} from '@/lib/delegation-execution'
import { OllamaAgentRunner, isOllamaReachable } from '@/lib/agent-runner/ollama-runner'
import { budgetToMaxTurns } from '@/lib/budget-utils'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function writeDelegationsAtomic(delegations: Delegation[]) {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = DELEGATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

function appendLogs(id: string, newLogs: AgentLog[], statusOverride?: Delegation['status'], report?: DelegationReport) {
  const delegations = readDelegations()
  const idx = delegations.findIndex(d => d.id === id)
  if (idx < 0) return
  delegations[idx] = {
    ...delegations[idx],
    ...(statusOverride ? { status: statusOverride } : {}),
    ...(report ? { summaryReport: report } : {}),
    logs: [...(delegations[idx].logs ?? []), ...newLogs],
    updatedAt: new Date().toISOString(),
  }
  writeDelegationsAtomic(delegations)
}

function buildPrompt(delegation: Delegation): string {
  const c = delegation.contract
  const slug = c.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const branch = `${c.branchStrategy}/${slug}-task`
  const commitPrefix = c.taskType || 'feat'
  const maxTurns = budgetToMaxTurns(c.maxBudgetUsd)
  const checkpointTurn = Math.max(10, Math.floor(maxTurns * 0.4))

  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map((d, i) => `- [ ] ${d}`)
    .join('\n') || '- [ ] Task erfolgreich abgeschlossen'

  const context = c.context?.trim()
    ? `\n## Context\n${c.context.trim()}\n`
    : ''

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

type SkillCategory = NonNullable<import('@/lib/models/delegation').TaskContract['skillCategory']>

function buildSkillBlock(skill?: SkillCategory, filePatterns?: string[]): string {
  const patternNote = filePatterns && filePatterns.length > 0
    ? `\n## Allowed file patterns (scope constraint)\nOnly touch files matching: ${filePatterns.join(', ')}\nAny changes outside these patterns = scope drift → ESCALATE.\n`
    : ''

  const skillGuides: Record<SkillCategory, string> = {
    'api-route': `\n## Skill: API Route\n- Only export HTTP handlers (GET, POST, etc.) from route files — no types, no helpers\n- Move shared types to src/lib/ before use\n- Return NextResponse.json() with proper status codes\n- Handle missing/invalid input with 400/404\n`,
    'ui-component': `\n## Skill: UI Component\n- Tailwind CSS only — no inline styles, no external CSS\n- Handle: loading state, empty state, error state\n- No direct fetch() in components — use effect hooks\n- No imports from @/app/api/ in client components\n- useSearchParams() needs <Suspense> wrapper\n`,
    'data-model': `\n## Skill: Data Model\n- Place types in src/lib/models/ or src/lib/[feature]/\n- No 'any' types — use unknown + type guards at boundaries\n- File-based stores: always atomic write (tmp → rename)\n- Export types, not classes\n`,
    'test': `\n## Skill: Testing\n- Cover: happy path, error path, edge case (at minimum)\n- Mock filesystem and external services — don't hit real APIs\n- Use vi.mock() + vi.mocked() for consistent mocking\n- Test behavior, not implementation details\n`,
    'refactor': `\n## Skill: Refactor\n- Zero behavior change — existing tests must still pass\n- TypeScript 0 errors before and after\n- Move one thing at a time — don't combine rename + restructure\n- Update all imports when moving files\n`,
    'infrastructure': `\n## Skill: Infrastructure\n- Atomic file writes (write to .tmp, rename to target)\n- Handle missing config files gracefully (return defaults)\n- No hardcoded paths — use process.cwd() or path.join()\n`,
    'documentation': `\n## Skill: Documentation\n- Update existing docs, don't create new files unless needed\n- Keep NAS SSOT in sync (00a_CURRENT_BASELINE.md log entry)\n- No code changes — only docs\n`,
  }

  if (!skill) return patternNote
  return patternNote + (skillGuides[skill] ?? '')
}

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

function isClaudeAvailable(): boolean {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function runWithClaudeCLI(id: string, prompt: string, startTime: Date, budgetUsd: number) {
  const storedKeys = readStoredApiKeys()
  const anthropicKey = storedKeys.ANTHROPIC_API_KEY?.trim() || undefined
  const maxTurns = budgetToMaxTurns(budgetUsd)

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

    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: success ? 'success' : 'error',
      message: success
        ? `✅ Ausführung abgeschlossen (Exit-Code: ${code}${actualCost ? `, Kosten: $${actualCost.toFixed(4)}` : ''})`
        : knownError
          ? `❌ ${knownError}`
          : `❌ Ausführung fehlgeschlagen (Exit-Code: ${code})`,
    }

    const report: DelegationReport | undefined = success
      ? { keyPoints: ['Ausführung via Claude CLI abgeschlossen'], changes: [], timeTakenMinutes: elapsed, ...(prUrl ? { prUrl } : {}) }
      : undefined

    // Only update if still running (not already cancelled)
    const allDelegations = readDelegations()
    const current = allDelegations.find(d => d.id === id)
    if (current && current.status === 'running') {
      const idx = allDelegations.findIndex(d => d.id === id)
      const finalStatus = success ? 'completed' : 'failed'
      allDelegations[idx] = {
        ...current,
        status: finalStatus,
        ...(actualCost ? { actualCostUsd: actualCost } : {}),
        ...(report ? { summaryReport: report } : {}),
        logs: [...(current.logs ?? []), ...logBuffer, finalLog],
        updatedAt: new Date().toISOString(),
      }
      writeDelegationsAtomic(allDelegations)

      const finishedDelegation = allDelegations[idx]

      // Linear writeback — fire-and-forget
      if (success && report) {
        postLinearCompletionComment(finishedDelegation).catch(() => {})
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
    }
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
    appendLogs(id, [errLog], 'failed')
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
    onLog: logs => appendLogs(id, logs),
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

    appendLogs(id, [finalLog], result.success ? 'completed' : 'failed', report)

    const finished = readDelegations().find(d => d.id === id)
    if (finished) {
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
    }
  } catch (err) {
    const msg = (err as Error).message
    const errLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `❌ Ollama-Runner-Fehler: ${msg}`,
    }
    appendLogs(id, [errLog], 'failed')
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
      appendLogs(id, [log], isLast ? 'completed' : undefined, report)
    }, capturedDelay)
  }
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params

  const delegations = readDelegations()
  const delegation = delegations.find(d => d.id === id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const blocker = getExecutionStartBlocker(delegation)
  if (blocker) {
    return NextResponse.json({ error: blocker.error }, { status: blocker.status })
  }

  // Auto-orchestrate: decompose into sub-tasks and run each sequentially
  if (delegation.autoOrchestrate) {
    const startLog = buildExecutionStartLog(delegation)
    appendLogs(id, [startLog], 'running')

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
    }).catch(console.error)

    return NextResponse.json({ started: true, mode: 'orchestrated', delegationId: id, runId: run.id })
  }

  // Immediately mark as running
  const startLog = buildExecutionStartLog(delegation)
  appendLogs(id, [startLog], 'running')

  const startTime = new Date()
  const prompt = buildPrompt(delegation)

  if (delegation.executionRoute === 'ollama-agent') {
    const model = delegation.contract.llmModel?.trim() || 'qwen2.5-coder:14b'
    void runWithOllamaAgent(id, prompt, startTime, delegation.contract.maxBudgetUsd, model)
    return NextResponse.json({ started: true, mode: 'ollama-agent', delegationId: id, model })
  }

  if (isClaudeAvailable()) {
    runWithClaudeCLI(id, prompt, startTime, delegation.contract.maxBudgetUsd)
    return NextResponse.json({ started: true, mode: 'claude-cli', delegationId: id })
  } else {
    runSimulation(id, delegation)
    return NextResponse.json({ started: true, mode: 'simulation', delegationId: id })
  }
}
