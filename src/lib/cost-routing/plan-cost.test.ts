import { describe, it, expect } from 'vitest'
import { classifyComplexity, estimatePlanCost, type PlanStep } from './plan-cost'
import type { RouterRecommendation, TaskComplexity } from '@/lib/ai/auto-router'

function localRec(): RouterRecommendation {
  return { providerId: 'ollama', providerName: 'Ollama (Lokal)', model: 'llama3', reason: '', isFree: true, isLocal: true, isCLI: false, estimatedCostPer1kTokens: 0 }
}
function cloudRec(cost = 0.003): RouterRecommendation {
  return { providerId: 'anthropic', providerName: 'Anthropic (Claude API)', model: 'haiku', reason: '', isFree: false, isLocal: false, isCLI: false, estimatedCostPer1kTokens: cost }
}

describe('classifyComplexity', () => {
  it('detects complex via architecture/security keywords', () => {
    expect(classifyComplexity({ title: 'Refactor auth layer' })).toBe('complex')
    expect(classifyComplexity({ title: 'X', description: 'improve security' })).toBe('complex')
  })
  it('detects coding via build/feature keywords', () => {
    expect(classifyComplexity({ title: 'Add search API endpoint' })).toBe('coding')
  })
  it('falls back to simple', () => {
    expect(classifyComplexity({ title: 'Update the wording' })).toBe('simple')
  })
})

describe('estimatePlanCost', () => {
  it('routes simple steps locally → free, with plain German', () => {
    const steps: PlanStep[] = [{ title: 'Tidy up copy' }]
    const est = estimatePlanCost(steps, undefined, () => localRec())
    expect(est.cloudCount).toBe(0)
    expect(est.localCount).toBe(1)
    expect(est.totalCostEur).toBe(0)
    expect(est.summary).toMatch(/lokal & kostenlos/)
    expect(est.steps[0]!.plainText).toMatch(/kostenlos/)
  })

  it('routes coding steps to the cloud and sums a non-zero cost', () => {
    const steps: PlanStep[] = [{ title: 'Build the payment API' }]
    const est = estimatePlanCost(steps, undefined, () => cloudRec(0.003))
    expect(est.cloudCount).toBe(1)
    expect(est.totalCostEur).toBeGreaterThan(0)
    expect(est.summary).toMatch(/Geschätzte Kosten/)
    expect(est.steps[0]!.plainText).toMatch(/Cloud/)
  })

  it('mixes local and cloud per step complexity', () => {
    const steps: PlanStep[] = [{ title: 'Update the wording' }, { title: 'Implement billing feature' }]
    const est = estimatePlanCost(steps, undefined, (c: TaskComplexity) => c === 'simple' ? localRec() : cloudRec(0.003))
    expect(est.localCount).toBe(1)
    expect(est.cloudCount).toBe(1)
  })

  it('handles no available provider gracefully', () => {
    const est = estimatePlanCost([{ title: 'Do something' }], undefined, () => null)
    expect(est.steps[0]!.plainText).toMatch(/kein Provider/)
    expect(est.totalCostEur).toBe(0)
  })

  it('returns an empty summary for no steps', () => {
    const est = estimatePlanCost([], undefined, () => localRec())
    expect(est.summary).toMatch(/Keine Schritte/)
  })
})
