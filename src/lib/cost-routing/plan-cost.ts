/**
 * Cost-Routing — plain-language cost & routing preview for a build plan.
 *
 * For each step we:
 * 1. classify its complexity from the text (simple / coding / complex),
 * 2. route it local-first via the existing selectBestProvider() — cheap steps
 *    go to Ollama / a CLI sub (free), coding/complex steps to the cloud,
 * 3. estimate a rough token budget and turn it into a cost,
 * 4. phrase everything in simple German so a non-techie understands what runs
 *    where and roughly what it costs BEFORE the build starts.
 *
 * Estimates are deliberately coarse — the summary says so. Routing reuses the
 * proven selectBestProvider(); it is injectable so this stays unit-testable.
 */
import {
  selectBestProvider,
  DEFAULT_ROUTER_PREFS,
  type TaskComplexity,
  type RouterPreferences,
  type RouterRecommendation,
} from '@/lib/ai/auto-router'

export interface PlanStep {
  title: string
  description?: string
}

export interface StepCostEstimate {
  step: PlanStep
  complexity: TaskComplexity
  providerName: string
  isLocal: boolean
  isFree: boolean
  estimatedTokens: number
  estimatedCostEur: number
  /** Plain-German one-liner for this step. */
  plainText: string
}

export interface PlanCostEstimate {
  steps: StepCostEstimate[]
  totalCostEur: number
  localCount: number
  cloudCount: number
  /** Plain-German overall summary. */
  summary: string
}

/** Rough token budget per build step by complexity (input+output combined). */
const TOKEN_BUDGET: Record<TaskComplexity, number> = {
  simple: 30_000,
  coding: 150_000,
  complex: 350_000,
}

/** Coarse USD→EUR factor for plain-language display; not a billing rate. */
export const USD_TO_EUR = 0.92

const COMPLEX_HINTS = ['architekt', 'architecture', 'refactor', 'migrat', 'redesign', 'security', 'sicherheit', 'skalier', 'scal', 'auth', 'infrastruct', 'infrastruktur']
const CODING_HINTS = ['implement', 'build', 'baue', 'code', 'api', 'function', 'funktion', 'feature', 'fix', 'bug', 'test', 'endpoint', 'component', 'komponente', 'integration', 'datenbank', 'database', 'schema']

/** Classify a step's complexity from its title + description. */
export function classifyComplexity(step: PlanStep): TaskComplexity {
  const text = `${step.title} ${step.description ?? ''}`.toLowerCase()
  if (COMPLEX_HINTS.some(h => text.includes(h))) return 'complex'
  if (CODING_HINTS.some(h => text.includes(h))) return 'coding'
  return 'simple'
}

/** Format a EUR amount in plain German (e.g. "0,46 €", "<0,01 €"). */
export function eur(amount: number): string {
  if (amount === 0) return '0 €'
  if (amount < 0.01) return '<0,01 €'
  return `${amount.toFixed(2).replace('.', ',')} €`
}

type SelectFn = (complexity: TaskComplexity, prefs: RouterPreferences) => RouterRecommendation | null

/**
 * Estimate routing + cost for a whole plan, in plain German.
 * `select` is injectable for testing (defaults to the real router).
 */
export function estimatePlanCost(
  steps: PlanStep[],
  prefs: RouterPreferences = DEFAULT_ROUTER_PREFS,
  select: SelectFn = selectBestProvider,
): PlanCostEstimate {
  const stepEstimates: StepCostEstimate[] = steps.map(step => {
    const complexity = classifyComplexity(step)
    const rec = select(complexity, prefs)
    const tokens = TOKEN_BUDGET[complexity]
    const costUsd = rec ? (tokens / 1000) * rec.estimatedCostPer1kTokens : 0
    const costEur = Math.round(costUsd * USD_TO_EUR * 100) / 100
    const isLocal = rec?.isLocal ?? false
    const isFree = rec?.isFree ?? (costEur === 0)
    const providerName = rec?.providerName ?? 'kein Provider verfügbar'

    const plainText = !rec
      ? `„${step.title}" → kein Provider verfügbar (API-Key hinterlegen oder Ollama starten).`
      : isFree || isLocal
        ? `„${step.title}" → läuft ${isLocal ? 'lokal ' : ''}über ${providerName}, kostenlos.`
        : `„${step.title}" → ${providerName} (Cloud), ca. ${eur(costEur)}.`

    return { step, complexity, providerName, isLocal, isFree, estimatedTokens: tokens, estimatedCostEur: costEur, plainText }
  })

  const totalCostEur = Math.round(stepEstimates.reduce((s, e) => s + e.estimatedCostEur, 0) * 100) / 100
  const localCount = stepEstimates.filter(e => e.isLocal || e.isFree).length
  const cloudCount = stepEstimates.length - localCount

  let summary: string
  if (stepEstimates.length === 0) {
    summary = 'Keine Schritte zum Schätzen.'
  } else if (cloudCount === 0) {
    summary = `Komplett lokal & kostenlos — alle ${localCount} Schritt(e) laufen auf deinem Rechner.`
  } else {
    summary = `Geschätzte Kosten: ca. ${eur(totalCostEur)} · ${localCount} Schritt(e) lokal/kostenlos, ${cloudCount} über Cloud. Grobe Schätzung — die echten Kosten hängen von der tatsächlichen Arbeitsmenge ab.`
  }

  return { steps: stepEstimates, totalCostEur, localCount, cloudCount, summary }
}
