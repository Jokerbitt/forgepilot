import type { AgentLog, Delegation, TaskContract } from '@/lib/models/delegation'
import { budgetToMaxTurns } from '@/lib/budget-utils'
import type { MemoryCard } from '@/lib/knowledge/types'

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

/**
 * Build the full agent execution prompt for a delegation.
 * When contextCards are provided, a "Relevant Past Learnings" block is inserted
 * directly after the ## Task block to enrich agent context.
 */
export function buildPrompt(delegation: Delegation, contextCards?: MemoryCard[]): string {
  const c = delegation.contract
  const slug = c.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const branch = `${c.branchStrategy}/${slug}-task`
  const commitPrefix = c.taskType || 'feat'
  const maxTurns = budgetToMaxTurns(c.maxBudgetUsd)
  const checkpointTurn = Math.max(10, Math.floor(maxTurns * 0.4))

  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map(d => `- [ ] ${d}`)
    .join('\n') || '- [ ] Task erfolgreich abgeschlossen'

  const context = c.context?.trim()
    ? `\n## Context\n${c.context.trim()}\n`
    : ''

  const learningsBlock = contextCards && contextCards.length > 0
    ? `\n## Relevant Past Learnings (from previous agent runs)\n${contextCards.map(c => `- **${c.title}**: ${c.body.slice(0, 200)}`).join('\n')}\n`
    : ''

  const skillBlock = buildSkillBlock(c.skillCategory, c.allowedFilePatterns)

  return `You are an autonomous software engineering agent working on **ForgePilot** — a local-first AI Workflow OS built with Next.js 14, TypeScript strict, Tailwind CSS, and Vitest.

## Task
${c.goal}
${learningsBlock}${context}
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
