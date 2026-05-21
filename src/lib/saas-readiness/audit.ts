export type SaaSReadinessSeverity = 'critical' | 'high' | 'medium' | 'low'
export type SaaSReadinessStatus = 'ready' | 'partial' | 'missing'

export interface SaaSReadinessCheck {
  id: string
  title: string
  category: 'auth' | 'tenancy' | 'billing' | 'privacy' | 'market'
  severity: SaaSReadinessSeverity
  status: SaaSReadinessStatus
  summary: string
  evidence: string[]
  recommendation: string
}

export interface SaaSReadinessAudit {
  score: number
  readiness: 'blocked' | 'at_risk' | 'launch_candidate'
  generatedAt: string
  checks: SaaSReadinessCheck[]
  nextActions: SaaSReadinessCheck[]
}

function envPresent(env: NodeJS.ProcessEnv, key: string): boolean {
  return Boolean(env[key]?.trim())
}

function checkWeight(check: SaaSReadinessCheck): number {
  const severityWeight = {
    critical: 30,
    high: 22,
    medium: 14,
    low: 8,
  } satisfies Record<SaaSReadinessSeverity, number>

  const statusPenalty = {
    ready: 0,
    partial: 0.45,
    missing: 1,
  } satisfies Record<SaaSReadinessStatus, number>

  return severityWeight[check.severity] * statusPenalty[check.status]
}

function readinessFromScore(score: number, checks: SaaSReadinessCheck[]): SaaSReadinessAudit['readiness'] {
  if (checks.some(check => check.severity === 'critical' && check.status === 'missing')) return 'blocked'
  if (score >= 80) return 'launch_candidate'
  return 'at_risk'
}

export function buildSaaSReadinessAudit(env: NodeJS.ProcessEnv = process.env, now = new Date()): SaaSReadinessAudit {
  const authEnabled = envPresent(env, 'FORGEPILOT_AUTH_ENABLED')
  const nextAuthSecret = envPresent(env, 'NEXTAUTH_SECRET')
  const adminEmail = envPresent(env, 'FORGEPILOT_ADMIN_EMAIL')
  const adminPassword = envPresent(env, 'FORGEPILOT_ADMIN_PASSWORD')
  const supabaseConfigured = envPresent(env, 'SUPABASE_URL') && envPresent(env, 'SUPABASE_ANON_KEY')
  const stripeConfigured = envPresent(env, 'STRIPE_SECRET_KEY') || envPresent(env, 'STRIPE_WEBHOOK_SECRET')
  const dsgvoExportReady = true
  const publicPricingReady = envPresent(env, 'FORGEPILOT_PRICING_PUBLIC')

  const checks: SaaSReadinessCheck[] = [
    {
      id: 'auth-boundary',
      title: 'Login und Session-Grenze',
      category: 'auth',
      severity: 'critical',
      status: authEnabled && nextAuthSecret && adminEmail && adminPassword ? 'ready' : authEnabled || nextAuthSecret ? 'partial' : 'missing',
      summary: 'SaaS-Betrieb braucht eine klare Auth-Grenze fuer App und API.',
      evidence: [
        `FORGEPILOT_AUTH_ENABLED=${authEnabled ? 'gesetzt' : 'fehlt'}`,
        `NEXTAUTH_SECRET=${nextAuthSecret ? 'gesetzt' : 'fehlt'}`,
        `Admin-Credentials=${adminEmail && adminPassword ? 'gesetzt' : 'unvollstaendig'}`,
      ],
      recommendation: 'M166 mergen, Auth aktivieren und Admin-Credentials pro Deployment setzen.',
    },
    {
      id: 'multi-tenancy',
      title: 'Tenant-Isolation',
      category: 'tenancy',
      severity: 'critical',
      status: supabaseConfigured ? 'partial' : 'missing',
      summary: 'Die aktuelle JSON-Persistenz ist stark fuer local-first, aber nicht ausreichend fuer mehrere Kunden.',
      evidence: [
        'Runtime-State liegt primaer in config/*.json',
        `Supabase=${supabaseConfigured ? 'konfiguriert' : 'nicht konfiguriert'}`,
      ],
      recommendation: 'Tenant-ID als Pflichtfeld in neue Stores/APIs einfuehren und einen Supabase/Postgres-Migrationspfad definieren.',
    },
    {
      id: 'billing-hook',
      title: 'Billing-Hook',
      category: 'billing',
      severity: 'high',
      status: stripeConfigured ? 'partial' : 'missing',
      summary: 'Kostenkontrolle existiert, aber ein echter Zahlungs- und Plan-Lifecycle fehlt noch.',
      evidence: [
        'Provider-Kosten und Budgets werden bereits getrackt',
        `Stripe=${stripeConfigured ? 'teilweise konfiguriert' : 'nicht konfiguriert'}`,
      ],
      recommendation: 'Stripe Customer + Subscription Webhook als minimalen Billing-Adapter anlegen.',
    },
    {
      id: 'privacy-consent',
      title: 'DSGVO Consent Flow',
      category: 'privacy',
      severity: 'high',
      status: dsgvoExportReady ? 'partial' : 'missing',
      summary: 'Export/Erasure-Bausteine sind vorhanden, aber Nutzereinwilligung und Datenverarbeitungshinweis fehlen als Flow.',
      evidence: [
        'DSGVO Export/Erasure API ist vorhanden',
        'Consent UI und Audit-Timestamp fehlen noch als Produktflow',
      ],
      recommendation: 'Consent Screen in Onboarding und Settings ergaenzen, inklusive Zweckbindung fuer Cloud-Provider.',
    },
    {
      id: 'pricing-wireframe',
      title: 'Pricing und Packaging',
      category: 'market',
      severity: 'medium',
      status: publicPricingReady ? 'partial' : 'missing',
      summary: 'Vor Launch braucht ForgePilot klare Pakete: Solo, Team und lokale/Cloud-Credits.',
      evidence: [
        `FORGEPILOT_PRICING_PUBLIC=${publicPricingReady ? 'gesetzt' : 'fehlt'}`,
        'Public Pricing Page ist noch kein sichtbarer Produktpfad',
      ],
      recommendation: 'Pricing-Wireframe mit Solo, Team und Usage-Credits erstellen; noch nicht an echtes Billing koppeln.',
    },
  ]

  const penalty = checks.reduce((sum, check) => sum + checkWeight(check), 0)
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)))
  const nextActions = checks
    .filter(check => check.status !== 'ready')
    .sort((a, b) => checkWeight(b) - checkWeight(a))
    .slice(0, 3)

  return {
    score,
    readiness: readinessFromScore(score, checks),
    generatedAt: now.toISOString(),
    checks,
    nextActions,
  }
}
