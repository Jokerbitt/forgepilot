import type { GitHubPullRequestPreview } from '@/lib/connectors/github'
import type { Delegation } from '@/lib/models/delegation'

export type MergeSafetyMode = 'manual' | 'auto'
export type MergeSafetyStatus = 'ready' | 'review' | 'blocked'

export interface MergeSafetyPolicy {
  mode: MergeSafetyMode
  maxChangedFiles: number
  maxLineChanges: number
  minCriticScore: number
}

export interface MergeSafetyVerdict {
  status: MergeSafetyStatus
  reasons: string[]
  policy: MergeSafetyPolicy
}

export const DEFAULT_MANUAL_MERGE_POLICY: MergeSafetyPolicy = {
  mode: 'manual',
  maxChangedFiles: 12,
  maxLineChanges: 800,
  minCriticScore: 75,
}

export const DEFAULT_AUTO_MERGE_POLICY: MergeSafetyPolicy = {
  mode: 'auto',
  maxChangedFiles: 5,
  maxLineChanges: 250,
  minCriticScore: 85,
}

const SENSITIVE_FILE_PATTERNS = [
  /^\.env/i,
  /(^|\/)\.env/i,
  /secret/i,
  /credential/i,
  /private[-_]?key/i,
  /auth/i,
  /nextauth/i,
  /middleware/i,
  /migration/i,
  /schema/i,
  /drizzle/i,
]

const SECRET_PATCH_PATTERNS = [
  /api[_-]?key\s*[:=]\s*['"][^'"]{12,}/i,
  /token\s*[:=]\s*['"][^'"]{12,}/i,
  /secret\s*[:=]\s*['"][^'"]{12,}/i,
  /password\s*[:=]\s*['"][^'"]{6,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
]

function criticAverage(delegation?: Delegation): number | null {
  if (!delegation?.criticScore) return null
  const { correctness, efficiency, drift } = delegation.criticScore
  return Math.round((correctness + efficiency + drift) / 3)
}

function containsSensitivePatch(preview: GitHubPullRequestPreview): boolean {
  return preview.files.some(file => {
    const patch = file.patchPreview ?? ''
    return SECRET_PATCH_PATTERNS.some(pattern => pattern.test(patch))
  })
}

function touchesSensitiveFiles(preview: GitHubPullRequestPreview): string[] {
  return preview.files
    .filter(file => SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(file.filename)))
    .map(file => file.filename)
}

export function evaluateMergeSafety(
  preview: GitHubPullRequestPreview,
  options: {
    delegation?: Delegation
    mode?: MergeSafetyMode
    policy?: Partial<MergeSafetyPolicy>
  } = {},
): MergeSafetyVerdict {
  const basePolicy = options.mode === 'auto' ? DEFAULT_AUTO_MERGE_POLICY : DEFAULT_MANUAL_MERGE_POLICY
  const policy: MergeSafetyPolicy = { ...basePolicy, ...options.policy, mode: options.mode ?? basePolicy.mode }
  const reasons: string[] = []
  const blockingReasons: string[] = []

  if (preview.draft) blockingReasons.push('Pull Request ist noch als Draft markiert.')
  if (preview.state !== 'open') blockingReasons.push('Pull Request ist nicht offen.')
  if (preview.mergeable === false) blockingReasons.push('GitHub meldet Merge-Konflikte.')
  if (preview.mergeRecommendation.status === 'blocked') {
    blockingReasons.push(...preview.mergeRecommendation.reasons)
  }

  if (preview.checks.state !== 'success') {
    blockingReasons.push(`CI/Checks sind nicht grün (${preview.checks.state}).`)
  }

  const lineChanges = preview.additions + preview.deletions
  if (preview.changedFiles > policy.maxChangedFiles) {
    reasons.push(`Zu viele Dateien geändert (${preview.changedFiles}/${policy.maxChangedFiles}).`)
  }
  if (lineChanges > policy.maxLineChanges) {
    reasons.push(`Zu große Änderung (${lineChanges}/${policy.maxLineChanges} Zeilen).`)
  }

  const sensitiveFiles = touchesSensitiveFiles(preview)
  if (sensitiveFiles.length > 0) {
    reasons.push(`Sensible Bereiche betroffen: ${sensitiveFiles.slice(0, 5).join(', ')}.`)
  }
  if (containsSensitivePatch(preview)) {
    blockingReasons.push('Patch enthält potenziell sensible Werte wie Token, Secrets oder Passwörter.')
  }

  const riskClass = options.delegation?.contract.riskClass
  if (policy.mode === 'auto' && riskClass !== 'A') {
    blockingReasons.push(`Auto-Merge ist nur für Risk A erlaubt (aktuell: ${riskClass ?? 'unbekannt'}).`)
  }

  const score = criticAverage(options.delegation)
  if (score === null && (policy.mode === 'auto' || options.delegation)) {
    reasons.push('Critic Score fehlt.')
  } else if (score !== null && score < policy.minCriticScore) {
    reasons.push(`Critic Score zu niedrig (${score}/${policy.minCriticScore}).`)
  }
  if (options.delegation?.criticScore?.verdict && options.delegation.criticScore.verdict !== 'approved') {
    blockingReasons.push(`Critic Verdict ist nicht approved (${options.delegation.criticScore.verdict}).`)
  }

  if (blockingReasons.length > 0) {
    return { status: 'blocked', reasons: [...new Set(blockingReasons)], policy }
  }

  if (reasons.length > 0 || preview.mergeRecommendation.status !== 'ready') {
    return {
      status: 'review',
      reasons: [...new Set([...reasons, ...preview.mergeRecommendation.reasons])],
      policy,
    }
  }

  return {
    status: 'ready',
    reasons: ['PR ist offen, mergebar, CI ist grün und die Safety-Policy ist erfüllt.'],
    policy,
  }
}
