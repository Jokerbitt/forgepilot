/**
 * Journey Companion — Phase 4.2: real-cost review.
 *
 * After a build, compares what it ACTUALLY cost (summed actualCostUsd of the
 * build's delegations) against the up-front ESTIMATE (summed costEstimateUsd)
 * and the budget cap — phrased in plain German so a non-techie sees "war es
 * teurer als gedacht? bin ich im Budget?". Turns a fuzzy guess into a verdict.
 *
 * Logic runs in USD (the Delegation model's currency, single source of truth);
 * display is in EUR via the same factor cost-routing uses, so the numbers line
 * up with the pre-build estimate the user already saw. Pure + unit-testable.
 */
import { USD_TO_EUR, eur as formatEur } from '@/lib/cost-routing/plan-cost'
import { checkBudget } from '@/lib/delegations/cost-format'

/** A build is cheaper / on-target / pricier than estimated, or fully free. */
export type CostVerdict = 'cheaper' | 'as-expected' | 'pricier' | 'free'

/** Minimal cost shape pulled from a Delegation (kept loose for testability). */
export interface DelegationCostFields {
  costEstimateUsd?: number
  actualCostUsd?: number
  maxBudgetUsd?: number
}

/** Aggregated USD totals across a build's delegations. */
export interface AggregatedCosts {
  estimatedCostUsd: number
  actualCostUsd: number
  maxBudgetUsd: number
}

export interface CostReviewInput {
  /** Plain-language app name for the headline. */
  appName?: string
  /** Up-front estimate in USD (sum of costEstimateUsd). */
  estimatedCostUsd: number
  /** Actual cost in USD (sum of actualCostUsd). */
  actualCostUsd: number
  /** Optional budget cap in USD (sum of contract.maxBudgetUsd); <= 0 means none. */
  maxBudgetUsd?: number
}

export interface CostReview {
  verdict: CostVerdict
  headline: string
  estimatedCostUsd: number
  actualCostUsd: number
  /** Estimate converted to EUR for consistent display. */
  estimatedCostEur: number
  /** Actual cost converted to EUR for consistent display. */
  actualCostEur: number
  /** actual - estimate in EUR (negative = cheaper than estimated). */
  deltaEur: number
  /** Rounded % difference vs. estimate (positive = over); null when no estimate. */
  deltaPercent: number | null
  /** A budget was set and the actual cost exceeded it. */
  budgetExceeded: boolean
  /** >= 80% of the budget used (and not exceeded). */
  budgetWarning: boolean
  /** Plain-German budget line, or null when no budget was set. */
  budgetText: string | null
  /** Plain-German detail lines for the UI. */
  details: string[]
}

/** Difference under this percent counts as "as expected" (estimates are coarse). */
const TOLERANCE_PERCENT = 10

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Sum estimate / actual / budget across a build's delegations (all USD). */
export function aggregateDelegationCosts(items: DelegationCostFields[]): AggregatedCosts {
  let estimatedCostUsd = 0
  let actualCostUsd = 0
  let maxBudgetUsd = 0
  for (const item of items) {
    if (typeof item.costEstimateUsd === 'number' && item.costEstimateUsd > 0) estimatedCostUsd += item.costEstimateUsd
    if (typeof item.actualCostUsd === 'number' && item.actualCostUsd > 0) actualCostUsd += item.actualCostUsd
    if (typeof item.maxBudgetUsd === 'number' && item.maxBudgetUsd > 0) maxBudgetUsd += item.maxBudgetUsd
  }
  return {
    estimatedCostUsd: round2(estimatedCostUsd),
    actualCostUsd: round2(actualCostUsd),
    maxBudgetUsd: round2(maxBudgetUsd),
  }
}

/** Compare actual build cost vs. estimate + budget and phrase it in plain German. */
export function reviewCost(input: CostReviewInput): CostReview {
  const { estimatedCostUsd, actualCostUsd } = input
  const maxBudgetUsd = input.maxBudgetUsd ?? 0
  const name = input.appName?.trim() || 'Die App'

  const estimatedCostEur = round2(estimatedCostUsd * USD_TO_EUR)
  const actualCostEur = round2(actualCostUsd * USD_TO_EUR)
  const deltaEur = round2(actualCostEur - estimatedCostEur)
  const deltaPercent =
    estimatedCostUsd > 0 ? Math.round(((actualCostUsd - estimatedCostUsd) / estimatedCostUsd) * 100) : null

  let verdict: CostVerdict
  if (actualCostUsd <= 0) {
    verdict = 'free'
  } else if (estimatedCostUsd <= 0) {
    verdict = 'pricier'
  } else if (deltaPercent !== null && deltaPercent <= -TOLERANCE_PERCENT) {
    verdict = 'cheaper'
  } else if (deltaPercent !== null && deltaPercent >= TOLERANCE_PERCENT) {
    verdict = 'pricier'
  } else {
    verdict = 'as-expected'
  }

  let headline: string
  switch (verdict) {
    case 'free':
      headline = `✅ ${name} hat nichts gekostet — alles lief lokal/kostenlos.`
      break
    case 'cheaper':
      headline = `✅ ${name} war günstiger als gedacht — ${formatEur(actualCostEur)} statt geschätzt ${formatEur(estimatedCostEur)} (−${Math.abs(deltaPercent ?? 0)} %).`
      break
    case 'as-expected':
      headline = `✅ ${name} lag im Kostenrahmen — ${formatEur(actualCostEur)} (geschätzt ${formatEur(estimatedCostEur)}).`
      break
    case 'pricier':
      headline =
        estimatedCostUsd > 0
          ? `⚠️ ${name} war teurer als gedacht — ${formatEur(actualCostEur)} statt geschätzt ${formatEur(estimatedCostEur)} (+${deltaPercent ?? 0} %).`
          : `⚠️ ${name} hat ${formatEur(actualCostEur)} gekostet — vorab als kostenlos eingeschätzt.`
      break
  }

  const hasBudget = maxBudgetUsd > 0
  const budget = checkBudget(actualCostUsd, hasBudget ? maxBudgetUsd : 0)
  const budgetEur = round2(maxBudgetUsd * USD_TO_EUR)
  const budgetPct = Math.round(budget.usageRatio * 100)
  let budgetText: string | null = null
  if (hasBudget) {
    if (budget.exceeded) {
      budgetText = `❌ Budget überschritten: ${formatEur(actualCostEur)} von ${formatEur(budgetEur)} (${budgetPct} %).`
    } else if (budget.warning) {
      budgetText = `⚠️ Budget zu ${budgetPct} % genutzt: ${formatEur(actualCostEur)} von ${formatEur(budgetEur)}.`
    } else {
      budgetText = `✅ Im Budget: ${formatEur(actualCostEur)} von ${formatEur(budgetEur)} (${budgetPct} %).`
    }
  }

  const details = [`Vorab geschätzt: ${formatEur(estimatedCostEur)}`, `Tatsächlich: ${formatEur(actualCostEur)}`]
  if (budgetText) details.push(budgetText)

  return {
    verdict,
    headline,
    estimatedCostUsd: round2(estimatedCostUsd),
    actualCostUsd: round2(actualCostUsd),
    estimatedCostEur,
    actualCostEur,
    deltaEur,
    deltaPercent,
    budgetExceeded: hasBudget && budget.exceeded,
    budgetWarning: hasBudget && budget.warning,
    budgetText,
    details,
  }
}
