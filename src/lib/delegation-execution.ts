import type { AgentLog, Delegation, TaskContract } from '@/lib/models/delegation'
import { readKnowledgeCards } from '@/lib/knowledge/knowledge-card'

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

/**
 * Actor prefixes that denote an AUTOMATED approval (autopilot, auto-chain, cron,
 * retry loops, the Risk-A auto-approve). An approval from any of these is NOT a
 * human approval. Matched case-insensitively against approvedBy.actor.
 */
const AUTOMATED_APPROVAL_ACTOR = /^(auto-approve|autonomous-mode|autopilot|cron|chain|retry|loop-closure|critic-retry|next-safe|delivery-cycle|autonomy)/i

/**
 * ADR-003 D2: a Risk-C delegation may ONLY run when a HUMAN approved it. Returns
 * true only when approvedBy has a non-empty actor that is not one of the automated
 * approval sources. Missing approvedBy → false (fail-closed).
 */
export function isHumanApproval(approvedBy: Delegation['approvedBy']): boolean {
  const actor = approvedBy?.actor?.trim()
  if (!actor) return false
  return !AUTOMATED_APPROVAL_ACTOR.test(actor)
}

export function getExecutionStartBlocker(delegation: Delegation): ExecutionStartBlocker | undefined {
  if (delegation.status !== 'approved') {
    return {
      status: 400,
      error: `Delegation kann nicht gestartet werden — Status ist '${delegation.status}', muss 'approved' sein.`,
    }
  }

  // ADR-003 D2: Risk-C is NEVER self-approved. This is the central execution
  // choke-point — regardless of which of the many approval paths set
  // status='approved', a Risk-C run requires a HUMAN approvedBy record or it is
  // hard-blocked here. (Replaces the old requiresApproval-flag check, which an
  // autopilot path could bypass by setting requiresApproval=false.)
  if (delegation.contract.riskClass === 'C' && !isHumanApproval(delegation.approvedBy)) {
    return {
      status: 403,
      error: 'RiskClass C: Menschliche Freigabe erforderlich — Risk-C darf nicht automatisch/selbst freigegeben werden (ADR-003 D2). Es fehlt ein menschlicher approvedBy-Eintrag.',
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
  const errorLogs = (delegation.logs ?? [])
    .filter(l => l.type === 'error')
    .slice(-5)
  if (errorLogs.length === 0) return ''

  const lines = errorLogs.map(l => `- ${l.message.slice(0, 200)}`).join('\n')

  // Inject critic score feedback if available
  let criticBlock = ''
  if (delegation.criticScore) {
    const s = delegation.criticScore
    criticBlock = `\n## Critic Feedback (previous run)\nVerdict: ${s.verdict} | Correctness: ${s.correctness}/100 | Efficiency: ${s.efficiency}/100 | Drift: ${s.drift}/100\nSummary: ${s.summary?.slice(0, 300) ?? 'n/a'}\n`
  }

  // Inject similar failure lessons from past runs to help the retry avoid known pitfalls
  let lessonsBlock = ''
  try {
    const targetRepo = delegation.targetRepo ?? 'unknown'
    const allCards = readKnowledgeCards()
    const lessons = allCards
      .filter(c => c.tags.includes('failure-lesson') && c.sourceId !== delegation.id)
      .filter(c => c.tags.includes(targetRepo) || targetRepo === 'unknown')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
    if (lessons.length > 0) {
      const lessonLines = lessons
        .map(c => `### ${c.title}\n${c.content.slice(0, 300)}`)
        .join('\n\n')
      lessonsBlock = `\n## Lessons from Similar Past Failures\n${lessonLines}\n`
    }
  } catch {
    // Knowledge store read is best-effort
  }

  return `\n## Previous Attempt Failed\nThe last execution failed. Avoid these errors in the new attempt:\n${lines}\n${criticBlock}${lessonsBlock}`
}
