import { NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { Delegation, AgentLog, DelegationReport } from '@/lib/models/delegation'
import { registerProcess, unregisterProcess } from '@/lib/process-registry'
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
  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map(d => `- ${d}`)
    .join('\n') || '- Task erfolgreich abgeschlossen'

  const tools = (c.allowedTools ?? []).join(', ') || 'read_file, write_file, run_command'

  return `Du bist ein Software-Engineering-Agent für das ForgePilot AI Workflow OS Projekt (Next.js 14, TypeScript strict, Tailwind CSS).

## Aufgabe
${c.goal}

## Kontext
${c.context || 'Kein zusätzlicher Kontext angegeben.'}

## Definition of Done
${dod}

## Konfiguration
- Task-Typ: ${c.taskType || 'feature'}
- Risiko-Klasse: ${c.riskClass} (A=sicher/additiv, B=moderat/ändert Bestehendes, C=kritisch/benötigt Review)
- Branch-Strategie: ${c.branchStrategy}
- Max Budget: $${c.maxBudgetUsd}
- Erlaubte Tools: ${tools}

## Vorgehensweise
1. Lies CLAUDE.md und verstehe die Projektstruktur
2. Erstelle einen Git-Branch: ${c.branchStrategy}/${c.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-task
3. Implementiere die Aufgabe gemäß Definition of Done
4. Führe Tests aus: npm test -- --run
5. Führe Lint aus: npm run lint
6. Committe Änderungen: git commit -m "${c.taskType || 'feat'}: ${c.goal.substring(0, 60).replace(/"/g, "'")}"
7. Erstelle einen PR: gh pr create --title "..." --body "..."
8. Fasse am Ende zusammen, was du getan hast

Arbeite sorgfältig und melde Fortschritt.`
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

function isClaudeAvailable(): boolean {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function runWithClaudeCLI(id: string, prompt: string, startTime: Date) {
  const proc = spawn('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
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
    const lines = text.split('\n').filter(l => l.trim())
    for (const line of lines) {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: line.substring(0, 500),
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

    const finalLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: success ? 'success' : 'error',
      message: success
        ? `✅ Ausführung abgeschlossen (Exit-Code: ${code}${actualCost ? `, Kosten: $${actualCost.toFixed(4)}` : ''})`
        : `❌ Ausführung fehlgeschlagen (Exit-Code: ${code})`,
    }

    const report: DelegationReport | undefined = success
      ? { keyPoints: ['Ausführung via Claude CLI abgeschlossen'], changes: [], timeTakenMinutes: elapsed }
      : undefined

    // Only update if still running (not already cancelled)
    const allDelegations = readDelegations()
    const current = allDelegations.find(d => d.id === id)
    if (current && current.status === 'running') {
      const idx = allDelegations.findIndex(d => d.id === id)
      allDelegations[idx] = {
        ...current,
        status: success ? 'completed' : 'failed',
        ...(actualCost ? { actualCostUsd: actualCost } : {}),
        ...(report ? { summaryReport: report } : {}),
        logs: [...(current.logs ?? []), ...logBuffer, finalLog],
        updatedAt: new Date().toISOString(),
      }
      writeDelegationsAtomic(allDelegations)
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
    { delay: 14500,type: 'success', message: '✅ Simulation abgeschlossen (claude CLI nicht verfügbar — installiere claude für echte Ausführung)' },
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
    runWithClaudeCLI(id, prompt, startTime)
    return NextResponse.json({ started: true, mode: 'claude-cli', delegationId: id })
  } else {
    runSimulation(id, delegation)
    return NextResponse.json({ started: true, mode: 'simulation', delegationId: id })
  }
}
