/**
 * Journey Companion — extra idea: plain-language quality report.
 *
 * After a build, tells a non-techie in simple words how well it was checked
 * ("4 Schritte geprüft, alles bestanden, Ø 92/100") from each delegation's
 * Definition-of-Done quality verdict. Pure.
 */

export type QualityVerdict = 'passed' | 'partial' | 'failed'

export interface QualityInput {
  title: string
  verdict?: QualityVerdict
  score?: number
}

export interface QualityReport {
  headline: string
  allPassed: boolean
  checkedCount: number
  averageScore: number | null
  lines: string[]
}

const MARK: Record<QualityVerdict, string> = { passed: '✅', partial: '⚠️', failed: '❌' }
const LABEL: Record<QualityVerdict, string> = { passed: 'bestanden', partial: 'teilweise', failed: 'nicht bestanden' }

/** Humanize the quality verdicts of a built plan's steps. */
export function humanizeQuality(items: QualityInput[]): QualityReport {
  const checked = items.filter(i => i.verdict)
  const scores = checked.map(i => i.score).filter((s): s is number => typeof s === 'number')
  const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const passedCount = checked.filter(i => i.verdict === 'passed').length
  const allPassed = checked.length > 0 && passedCount === checked.length

  const lines = checked.map(i => `${MARK[i.verdict!]} ${i.title}: ${LABEL[i.verdict!]}${typeof i.score === 'number' ? ` (${i.score}/100)` : ''}`)

  let headline: string
  if (checked.length === 0) {
    headline = 'Noch keine Qualitätsprüfung verfügbar.'
  } else if (allPassed) {
    headline = `Alle ${checked.length} Schritte geprüft und bestanden${averageScore !== null ? ` (Ø ${averageScore}/100)` : ''}.`
  } else {
    headline = `${passedCount} von ${checked.length} Schritten bestanden${averageScore !== null ? ` (Ø ${averageScore}/100)` : ''}.`
  }

  return { headline, allPassed, checkedCount: checked.length, averageScore, lines }
}
