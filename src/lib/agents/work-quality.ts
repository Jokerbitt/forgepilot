/**
 * Work Quality Scorer
 *
 * Evaluates a completed atomic task and produces a quality score.
 * The score feeds into skill evolution — agents get better or worse
 * based on real outcomes.
 */

import type { AtomicTask } from './atomic-task'
import type { TaskResult } from './orchestrated-run'

export interface QualityInput {
  task: AtomicTask
  testsPassed: boolean
  typeErrorCount: number
  lintErrorCount: number
  filesChanged: number
  retryCount: number
  durationMinutes: number
}

export function scoreWork(input: QualityInput): TaskResult {
  const issues: string[] = []
  let score = 100

  // Type errors are critical (−20 each, max −40)
  if (input.typeErrorCount > 0) {
    const penalty = Math.min(input.typeErrorCount * 20, 40)
    score -= penalty
    issues.push(`${input.typeErrorCount} TypeScript error(s)`)
  }

  // Tests failing is critical
  if (!input.testsPassed) {
    score -= 30
    issues.push('Tests failed')
  }

  // Lint errors are significant
  if (input.lintErrorCount > 0) {
    const penalty = Math.min(input.lintErrorCount * 5, 20)
    score -= penalty
    issues.push(`${input.lintErrorCount} lint error(s)`)
  }

  // Too many files = scope creep
  const maxFiles = input.task.effort === 'S' ? 3 : input.task.effort === 'M' ? 6 : 12
  if (input.filesChanged > maxFiles) {
    score -= 10
    issues.push(`Too many files changed (${input.filesChanged} > expected ${maxFiles})`)
  }

  // Retries indicate drift
  if (input.retryCount > 0) {
    score -= input.retryCount * 5
    issues.push(`${input.retryCount} retry attempt(s)`)
  }

  // Duration vs effort
  const expected = { S: 20, M: 60, L: 150 }[input.task.effort]
  if (input.durationMinutes > expected * 2) {
    score -= 5
    issues.push(`Took ${input.durationMinutes}min (expected ~${expected}min)`)
  }

  score = Math.max(0, score)

  return {
    qualityScore: score,
    grade: scoreToGrade(score),
    issues,
    testsPassed: input.testsPassed,
    typeErrorCount: input.typeErrorCount,
    lintErrorCount: input.lintErrorCount,
    completedAt: new Date().toISOString(),
  }
}

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

export function shouldRetry(result: TaskResult, maxRetries: number, currentRetries: number): boolean {
  return result.grade === 'F' && currentRetries < maxRetries
}

export function improvementHints(result: TaskResult): string[] {
  const hints: string[] = []
  if (result.typeErrorCount > 0) hints.push('Fix TypeScript errors before committing')
  if (!result.testsPassed) hints.push('Run npm run test:run and fix failing tests')
  if (result.lintErrorCount > 0) hints.push('Run npm run lint and fix all errors')
  if (result.issues.some(i => i.includes('Too many files'))) {
    hints.push('Reduce scope: split into smaller sub-tasks')
  }
  if (result.issues.some(i => i.includes('retry'))) {
    hints.push('Clarify task acceptance criteria to avoid back-and-forth')
  }
  return hints
}
