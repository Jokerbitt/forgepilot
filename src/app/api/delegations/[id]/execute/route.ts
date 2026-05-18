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

  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map((d, i) => `${i + 1}. ${d}`)
    .join('\n') || '1. Task erfolgreich abgeschlossen'

  const context = c.context?.trim()
    ? `\n## Context\n${c.context.trim()}\n`
    : ''

  return `You are an autonomous software engineering agent working on **ForgePilot** — a local-first AI Workflow OS built with Next.js 14, TypeScript strict, Tailwind CSS, and Vitest.

## Task
${c.goal}
${context}
## Definition of Done
${dod}

## Constraints
- Risk class: **${c.riskClass}** (A = safe/additive, B = modifies existing, C = needs human review)
- Branch: \`${branch}\`
- Max budget: $${c.maxBudgetUsd} (~${budgetToMaxTurns(c.maxBudgetUsd)} turns)
- Work item: ${c.workItemId}

## Execution protocol (follow exactly)
\`\`\`
1. Read CLAUDE.md  →  understand conventions and project structure
2. git checkout -b ${branch}
3. Explore: read relevant source files before writing any code
4. Implement: small, focused changes — one concern per commit
5. Verify: npm run test:run && npm run lint && npm run type-check
   (run type-check BEFORE build — never in parallel)
6. Commit: git commit -m "${commitPrefix}: <description>"
7. PR: gh pr create --title "${commitPrefix}: ${c.goal.substring(0, 60).replace(/"/g, "'")}" --body "## Summary\\n- <bullets>\\n\\n## Test plan\\n- [ ] tests pass"
8. Final output: print a one-paragraph summary of what changed and why
\`\`\`

## Quality rules
- No \`any\` types. No unused imports. No comments stating the obvious.
- Tests must cover the new behavior — not just type-check.
- Never commit directly to main. Never force-push.
- If a step fails, diagnose root cause before retrying.
- If you are uncertain about scope or risk, stop and print "ESCALATION: <reason>" — do not guess.

Start now.`
}

/**
 * Map budget USD → max turns for claude CLI.
 * Prevents runaway costs while allowing meaningful work.
 * $1 → 15 turns, $5 → 40 turns, capped at 60.
 */
function budgetToMaxTurns(budgetUsd: number): number {
  return Math.min(60, Math.max(5, Math.round(budgetUsd * 15)))
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
  const childEnv = anthropicKey
    ? { ...baseEnv, ANTHROPIC_API_KEY: anthropicKey }
    : baseEnv

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

  // Immediately mark as running
  const startLog = buildExecutionStartLog(delegation)
  appendLogs(id, [startLog], 'running')

  const startTime = new Date()
  const prompt = buildPrompt(delegation)

  if (isClaudeAvailable()) {
    runWithClaudeCLI(id, prompt, startTime, delegation.contract.maxBudgetUsd)
    return NextResponse.json({ started: true, mode: 'claude-cli', delegationId: id })
  } else {
    runSimulation(id, delegation)
    return NextResponse.json({ started: true, mode: 'simulation', delegationId: id })
  }
}
