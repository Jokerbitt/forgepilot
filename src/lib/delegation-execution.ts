import type { AgentLog, Delegation, TaskContract } from '@/lib/models/delegation'

// ─── Prompt helpers ───────────────────────────────────────────────────────────

type SkillCategory = NonNullable<TaskContract['skillCategory']>

const SKILL_GUIDES: Record<SkillCategory, string> = {
  'api-route': `\n## Skill: API Route\n- Only export HTTP handlers (GET, POST, etc.) from route files\n- Return NextResponse.json() with proper status codes\n- Handle missing/invalid input with 400/404\n`,
  'ui-component': `\n## Skill: UI Component\n- Tailwind CSS only — no inline styles\n- Handle: loading, empty, error states\n- No direct fetch() in components — use effect hooks\n`,
  'data-model': `\n## Skill: Data Model\n- Place types in src/lib/models/ or src/lib/[feature]/\n- No 'any' — use unknown + type guards\n- Atomic file writes: tmp → rename\n`,
  'test': `\n## Skill: Testing\n- Cover: happy path, error path, edge case\n- Mock filesystem and external services\n- Test behavior, not implementation details\n`,
  'refactor': `\n## Skill: Refactor\n- Zero behavior change — existing tests must still pass\n- Move one thing at a time\n- Update all imports when moving files\n`,
  'infrastructure': `\n## Skill: Infrastructure\n- Atomic file writes (write to .tmp, rename to target)\n- Handle missing config gracefully\n- No hardcoded paths — use process.cwd()\n`,
  'documentation': `\n## Skill: Documentation\n- Update existing docs, don't create new files unless needed\n- Keep NAS SSOT in sync (00a_CURRENT_BASELINE.md)\n- No code changes — only docs\n`,
}

/**
 * Build the skill-specific guide block for inclusion in prompts.
 * Includes file pattern constraints when provided.
 */
export function buildSkillBlock(skill?: SkillCategory, filePatterns?: string[]): string {
  const patternNote = filePatterns && filePatterns.length > 0
    ? `\n## Allowed file patterns (scope constraint)\nOnly touch files matching: ${filePatterns.join(', ')}\nAny changes outside these patterns = scope drift → ESCALATE.\n`
    : ''
  if (!skill) return patternNote
  return patternNote + (SKILL_GUIDES[skill] ?? '')
}

/**
 * Focused prompt for orchestrated sub-tasks.
 * Minimal context → less drift. Only goal + acceptance criteria + file scope + skill guide.
 */
export function buildSubTaskPrompt(delegation: Delegation): string {
  const c = delegation.contract
  const maxTurns = Math.max(10, Math.round((c.maxBudgetUsd ?? 2) * 10))
  const slug = c.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const branch = `${c.branchStrategy ?? 'feature'}/${slug}-subtask`

  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map(d => `- [ ] ${d}`)
    .join('\n') || '- [ ] Task abgeschlossen'

  const fileConstraint = c.allowedFilePatterns?.length
    ? `\n## File scope (strict — stay inside or ESCALATE)\n${c.allowedFilePatterns.map(p => `- ${p}`).join('\n')}\n`
    : ''

  const skillGuide = buildSkillBlock(c.skillCategory, [])

  return `You are executing **one atomic sub-task** in ForgePilot (Next.js 14, TypeScript strict, Tailwind, Vitest).

## Goal
${c.goal}
${fileConstraint}
## Done when
${dod}

## Rules
- Branch: \`${branch}\`
- Max ${maxTurns} turns — print ESCALATION if exceeded
- 0 \`any\` types · 0 unused imports · tests cover new behavior
- Run: npm run test:run && npm run lint && npm run type-check (in order, NOT parallel)
- Commit only, no PR needed
${skillGuide}
Start. Be concise and stay in scope.`
}

export interface ExecutionStartBlocker {
  status: 400 | 403
  error: string
}

const AUTOMATED_CODE_ROUTES = new Set(['local-agent', 'runner', 'ollama-agent'])

export function getExecutionStartBlocker(delegation: Delegation): ExecutionStartBlocker | undefined {
  if (delegation.status !== 'approved') {
    return {
      status: 400,
      error: `Delegation kann nicht gestartet werden — Status ist '${delegation.status}', muss 'approved' sein.`,
    }
  }

  if (delegation.contract.riskClass === 'C' && delegation.contract.requiresApproval) {
    return {
      status: 403,
      error: 'RiskClass C: Manuelle Freigabe erforderlich. Setze requiresApproval=false nach bewusstem Review.',
    }
  }

  if (AUTOMATED_CODE_ROUTES.has(delegation.executionRoute)) {
    const dod = (delegation.contract.definitionOfDone ?? []).filter(item => item.trim().length > 0)
    if (dod.length === 0) {
      return {
        status: 400,
        error: 'Automatischer Code-Run blockiert: Es fehlt eine messbare Definition of Done. Ergänze mindestens ein konkretes Akzeptanzkriterium.',
      }
    }

    if (delegation.contract.maxBudgetUsd <= 0) {
      return {
        status: 400,
        error: 'Automatischer Code-Run blockiert: maxBudgetUsd muss größer als 0 sein. Setze ein realistisches Budget oder nutze einen manuellen/simulierten Lauf.',
      }
    }
  }

  return undefined
}

export function buildExecutionStartLog(delegation: Delegation): AgentLog {
  const budgetNote = delegation.contract.maxBudgetUsd > 0
    ? ` | Budget: $${delegation.contract.maxBudgetUsd.toFixed(2)}`
    : ''

  return {
    timestamp: new Date().toISOString(),
    type: 'info',
    message: `Ausfuehrung gestartet${budgetNote}`,
  }
}

export function buildSimulationBudgetLog(delegation: Delegation): Pick<AgentLog, 'type' | 'message'> {
  const budget = delegation.contract.maxBudgetUsd
  const estimate = delegation.costEstimateUsd

  if (estimate > budget) {
    return {
      type: 'error',
      message: `Kosten-Schaetzung ($${estimate.toFixed(2)}) ueberschreitet Budget ($${budget.toFixed(2)})`,
    }
  }

  return {
    type: 'info',
    message: `Budget: $${budget.toFixed(2)} | Schaetzung: $${estimate.toFixed(2)}`,
  }
}

export function buildRetryContext(delegation: Delegation): string {
  const parts: string[] = []

  if (delegation.escalationDecision) {
    parts.push(`\n## Escalation Resolved\nA previous run was paused waiting for a human decision. The user has now decided:\n${delegation.escalationDecision}\nContinue the task with this decision in mind. Do NOT escalate again for the same issue.\n`)
  }

  // M107: Inject test failure output so agent knows exactly what to fix
  if (delegation.testFailureOutput) {
    const attempt = delegation.autoRetryCount ?? 1
    parts.push(`\n## Auto-Retry (Attempt ${attempt}/3)\nThe previous run finished but tests failed. Fix these failures before committing:\n\`\`\`\n${delegation.testFailureOutput.slice(0, 3000)}\n\`\`\`\n`)
  }

  const errorLogs = (delegation.logs ?? [])
    .filter(l => l.type === 'error')
    .slice(-5)
  if (errorLogs.length > 0) {
    const lines = errorLogs.map(l => `- ${l.message.slice(0, 200)}`).join('\n')
    parts.push(`\n## Previous Attempt Failed\nLast errors to avoid:\n${lines}\n`)
  }

  return parts.join('')
}
