/**
 * skill-optimizer.ts — Token efficiency analysis and optimization proposals.
 *
 * Analyzes prompt skill metrics and proposes optimizations:
 * - Skills with low quality impact and high token cost → trim candidates
 * - Skills that consistently produce better outcomes → promote to 'global'
 * - Skills with 0 runs → flag as unused
 */

import { listSkills, updateSkill, type PromptSkill } from './prompt-skill-registry'

export type OptimizationAction = 'trim' | 'promote' | 'demote' | 'deprecate' | 'no-change'

export interface OptimizationProposal {
  skillId: string
  skillName: string
  action: OptimizationAction
  reason: string
  estimatedTokenSavings: number
  confidence: number          // 0-100: how confident are we this is a good change?
  autoApply: boolean          // true = apply without human review if confidence > 85
}

export interface OptimizationReport {
  proposals: OptimizationProposal[]
  totalEstimatedTokenSavings: number
  highConfidenceCount: number
  generatedAt: string
}

/**
 * Rough token count estimate (1 token ≈ 4 chars)
 */
function roughTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Analyze all skills and generate optimization proposals.
 */
export function analyzeSkills(): OptimizationReport {
  const skills = listSkills()
  const proposals: OptimizationProposal[] = []

  for (const skill of skills) {
    const m = skill.metrics
    const tokenCost = roughTokens(skill.content)

    // Unused skills (never ran)
    if (m.runsCount === 0 && skill.source !== 'builtin') {
      proposals.push({
        skillId: skill.id,
        skillName: skill.name,
        action: 'deprecate',
        reason: `Never used since creation (0 runs). Consider removing or merging.`,
        estimatedTokenSavings: tokenCost,
        confidence: 60,
        autoApply: false,
      })
      continue
    }

    // Enough data to judge
    if (m.runsCount < 5) continue

    // Declining + low quality → demote or deprecate
    if (m.trend === 'declining' && m.avgQualityScore < 60) {
      proposals.push({
        skillId: skill.id,
        skillName: skill.name,
        action: m.successRate < 0.4 ? 'deprecate' : 'demote',
        reason: `Declining trend, avg quality ${m.avgQualityScore}/100, success rate ${Math.round(m.successRate * 100)}%.`,
        estimatedTokenSavings: m.successRate < 0.4 ? tokenCost : Math.floor(tokenCost * 0.3),
        confidence: 75,
        autoApply: false, // Quality decisions need human review
      })
      continue
    }

    // High quality + global scope → already optimal
    if (m.avgQualityScore > 85 && m.trend !== 'declining') continue

    // Large skill with mediocre quality → trim candidate
    if (tokenCost > 200 && m.avgQualityScore < 75 && m.runsCount >= 10) {
      proposals.push({
        skillId: skill.id,
        skillName: skill.name,
        action: 'trim',
        reason: `${tokenCost} tokens but only ${m.avgQualityScore}/100 avg quality. Content likely has padding.`,
        estimatedTokenSavings: Math.floor(tokenCost * 0.4), // Estimate 40% can be removed
        confidence: 65,
        autoApply: false,
      })
    }

    // Improving + scoped skill → promote to global
    if (m.trend === 'improving' && m.avgQualityScore > 88 && skill.scope !== 'global' && m.runsCount >= 8) {
      proposals.push({
        skillId: skill.id,
        skillName: skill.name,
        action: 'promote',
        reason: `Improving trend, ${m.avgQualityScore}/100 avg quality across ${m.runsCount} runs. Promote to global scope.`,
        estimatedTokenSavings: 0, // Promotion doesn't save tokens but improves quality
        confidence: 80,
        autoApply: true,
      })
    }
  }

  const totalSavings = proposals.reduce((sum, p) => sum + p.estimatedTokenSavings, 0)
  const highConf = proposals.filter(p => p.confidence >= 80).length

  return {
    proposals,
    totalEstimatedTokenSavings: totalSavings,
    highConfidenceCount: highConf,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Apply all proposals with autoApply=true and confidence >= threshold.
 */
export function applyAutoOptimizations(confidenceThreshold = 85): { applied: number; skipped: number } {
  const report = analyzeSkills()
  let applied = 0
  let skipped = 0

  for (const p of report.proposals) {
    if (!p.autoApply || p.confidence < confidenceThreshold) {
      skipped++
      continue
    }
    if (p.action === 'promote') {
      updateSkill(p.skillId, { scope: 'global' })
      applied++
    }
    // Other auto-apply actions can be added here
  }

  return { applied, skipped }
}

/**
 * Generate a concise text summary of the optimization report for the Daily Assistant.
 */
export function summarizeOptimizations(): string {
  const report = analyzeSkills()
  if (report.proposals.length === 0) return ''
  const savings = report.totalEstimatedTokenSavings
  const count = report.proposals.length
  return `${count} Skill-Optimierung(en) möglich · ~${savings} Token Einsparung · ${report.highConfidenceCount} hochkonfident`
}
