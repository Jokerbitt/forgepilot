/**
 * Turn selected suggestions (+ an optional custom one) into a DelegationPlan:
 * one phase per selection, executed SEQUENTIALLY (each phase depends on the
 * previous) and VALIDATED (every phase's Definition of Done requires a green
 * build, passing tests, and 0 type errors). Reuses the existing plan → chain
 * execution + build-gate, so nothing new is needed to run/validate it.
 */
import type { DelegationPlan, PlanPhase } from '@/lib/delegations/plan-generator'
import type { Suggestion } from './generator'

export interface ToPlanInput {
  goal: string
  context?: string
  targetRepo?: string
  selected: Suggestion[]
  /** Optional free-text "other" step the user typed. */
  custom?: string
  /** Deterministic id factory (inject in tests). */
  newId: () => string
  /** ISO timestamp (inject in tests — the route passes new Date().toISOString()). */
  now: string
}

/** Standard validation gate appended to every phase's Definition of Done. */
const VALIDATION_DOD = ['npm run build green (production)', 'All Vitest tests pass', 'TypeScript 0 errors']

export function suggestionsToPlan(input: ToPlanInput): DelegationPlan {
  const steps: Array<{ title: string; description: string }> = [...input.selected]
  if (input.custom && input.custom.trim()) {
    steps.push({ title: 'Custom step', description: input.custom.trim() })
  }

  const phaseIds = steps.map(() => input.newId())
  const phases: PlanPhase[] = steps.map((step, i) => ({
    id: phaseIds[i]!,
    title: step.title,
    description: step.description,
    filesToCreate: [],
    filesToModify: [],
    dodItems: [`${step.title} fully implemented and wired into the app`, ...VALIDATION_DOD],
    riskClass: 'B',
    // >80 turns → the plan executor allocates the top budget tier; tolerant budget + resume cover overruns.
    estimatedTurns: 100,
    // Sequential: each phase waits for the previous one to complete + validate.
    dependsOn: i === 0 ? [] : [phaseIds[i - 1]!],
  }))

  return {
    id: input.newId(),
    goal: input.goal,
    context: input.context ?? '',
    targetRepo: input.targetRepo,
    overview: `Build ${phases.length} selected next step(s) sequentially, validating each (build + tests + types) before the next.`,
    phases,
    maxPhases: phases.length,
    createdAt: input.now,
    updatedAt: input.now,
    status: 'draft',
  }
}
