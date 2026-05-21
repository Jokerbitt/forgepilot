import fs from 'fs'
import path from 'path'

export type GapSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type GapStatus = 'missing' | 'partial' | 'done'

export interface ReadinessGap {
  id: string
  title: string
  description: string
  severity: GapSeverity
  status: GapStatus
  docsLink?: string
  effortDays: number
}

export interface SaaSReadinessReport {
  score: number           // 0-100
  gaps: ReadinessGap[]
  readyForSolo: boolean   // score >= 60
  readyForSaaS: boolean   // score >= 85
  generatedAt: string
}

const SEVERITY_WEIGHT: Record<GapSeverity, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1.5,
  LOW: 1,
}

function dirExistsWithMinFiles(dirPath: string, minFiles: number): boolean {
  try {
    const files = fs.readdirSync(dirPath)
    return files.length >= minFiles
  } catch {
    return false
  }
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    return false
  }
}

function buildGaps(env: Partial<NodeJS.ProcessEnv>): ReadinessGap[] {
  const cwd = process.cwd()

  const authEnabled = env.FORGEPILOT_AUTH_ENABLED === 'true'
  const onboardingExists = dirExistsWithMinFiles(path.join(cwd, 'src', 'app', 'onboarding'), 1)
  const e2eSpecCount = (() => {
    try {
      const e2eDir = path.join(cwd, 'e2e')
      const files = fs.readdirSync(e2eDir)
      return files.filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.js')).length
    } catch {
      return 0
    }
  })()
  const sentryDsnSet = Boolean(env.SENTRY_DSN)
  const readmeExists = fileExists(path.join(cwd, 'README.md'))

  const gaps: ReadinessGap[] = [
    {
      id: 'auth',
      title: 'Auth Layer',
      description: 'Authentication and authorization must be in place to protect user data and routes.',
      severity: 'CRITICAL',
      status: authEnabled ? 'done' : 'missing',
      docsLink: 'https://nextjs.org/docs/app/building-your-application/authentication',
      effortDays: authEnabled ? 0 : 5,
    },
    {
      id: 'onboarding',
      title: 'Onboarding Flow',
      description: 'A guided onboarding experience helps new users understand and adopt the product.',
      severity: 'HIGH',
      status: onboardingExists ? 'done' : 'missing',
      effortDays: onboardingExists ? 0 : 3,
    },
    {
      id: 'multi-tenancy',
      title: 'Multi-Tenancy',
      description: 'Current JSON stores are single-user. Multi-tenant isolation is required for SaaS.',
      severity: 'CRITICAL',
      status: 'missing',
      effortDays: 21,
    },
    {
      id: 'billing',
      title: 'Billing Integration',
      description: 'Payment processing and subscription management are required to monetize the product.',
      severity: 'HIGH',
      status: 'missing',
      docsLink: 'https://stripe.com/docs',
      effortDays: 7,
    },
    {
      id: 'e2e-tests',
      title: 'E2E Test Coverage',
      description: 'End-to-end tests provide confidence in critical user flows before shipping.',
      severity: 'MEDIUM',
      status: e2eSpecCount > 3 ? 'done' : 'partial',
      effortDays: e2eSpecCount > 3 ? 0 : 4,
    },
    {
      id: 'error-monitoring',
      title: 'Error Monitoring',
      description: 'Production error tracking (e.g. Sentry) is essential for diagnosing issues in real time.',
      severity: 'MEDIUM',
      status: sentryDsnSet ? 'done' : 'missing',
      docsLink: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
      effortDays: sentryDsnSet ? 0 : 1,
    },
    {
      id: 'rate-limiting',
      title: 'Rate Limiting',
      description: 'API rate limiting (M102) prevents abuse and ensures fair resource usage.',
      severity: 'HIGH',
      status: 'done',
      effortDays: 0,
    },
    {
      id: 'data-backup',
      title: 'Config Backup',
      description: 'Automated config backup (M161) protects against data loss.',
      severity: 'MEDIUM',
      status: 'done',
      effortDays: 0,
    },
    {
      id: 'health-checks',
      title: 'Health Checks',
      description: 'Health check endpoints (M160 /api/ready) enable monitoring and zero-downtime deploys.',
      severity: 'MEDIUM',
      status: 'done',
      effortDays: 0,
    },
    {
      id: 'public-docs',
      title: 'Public Documentation',
      description: 'Public-facing documentation helps users onboard independently.',
      severity: 'LOW',
      status: readmeExists ? 'partial' : 'missing',
      effortDays: 3,
    },
  ]

  return gaps
}

function computeScore(gaps: ReadinessGap[]): number {
  const totalGaps = gaps.length
  if (totalGaps === 0) return 0

  const totalWeight = gaps.reduce((sum, g) => sum + SEVERITY_WEIGHT[g.severity], 0)

  const earnedWeight = gaps
    .filter(g => g.status === 'done')
    .reduce((sum, g) => sum + SEVERITY_WEIGHT[g.severity], 0)

  const rawScore = (earnedWeight / totalWeight) * 100
  return Math.round(rawScore)
}

export function runSaaSAudit(env: Partial<NodeJS.ProcessEnv> = process.env): SaaSReadinessReport {
  const gaps = buildGaps(env)
  const score = computeScore(gaps)

  return {
    score,
    gaps,
    readyForSolo: score >= 60,
    readyForSaaS: score >= 85,
    generatedAt: new Date().toISOString(),
  }
}
