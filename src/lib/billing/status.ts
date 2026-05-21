export type BillingProvider = 'stripe'
export type BillingMode = 'not_configured' | 'partial' | 'test' | 'live'
export type BillingReadiness = 'missing' | 'partial' | 'ready'

export interface BillingPlan {
  id: 'solo-local' | 'solo-pro' | 'team'
  name: string
  audience: string
  monthlyPriceUsd: number | null
  included: string[]
  launchPhase: 'now' | 'next' | 'later'
}

export interface BillingStatus {
  provider: BillingProvider
  readiness: BillingReadiness
  mode: BillingMode
  generatedAt: string
  stripe: {
    secretKeyConfigured: boolean
    webhookSecretConfigured: boolean
    priceIdsConfigured: boolean
    customerPortalConfigured: boolean
  }
  plans: BillingPlan[]
  blockers: string[]
  nextActions: string[]
}

const SOLO_LOCAL: BillingPlan = {
  id: 'solo-local',
  name: 'Solo Local',
  audience: 'Single developer running ForgePilot locally or on a NAS',
  monthlyPriceUsd: null,
  launchPhase: 'now',
  included: [
    'Local JSON persistence',
    'Ollama and LM Studio routing',
    'Project briefs and delegations',
    'Agent scope board',
    'Local backups',
  ],
}

const SOLO_PRO: BillingPlan = {
  id: 'solo-pro',
  name: 'Solo Pro',
  audience: 'Power user with hosted convenience and advanced orchestration',
  monthlyPriceUsd: 29,
  launchPhase: 'next',
  included: [
    'Hosted workspace option',
    'Cloud provider routing',
    'Cost analytics',
    'Grok critic evaluations',
    'Advanced project memory',
  ],
}

const TEAM: BillingPlan = {
  id: 'team',
  name: 'Team',
  audience: 'Small team coordinating humans and AI agents',
  monthlyPriceUsd: 79,
  launchPhase: 'later',
  included: [
    'Multi-user auth',
    'Tenant isolation',
    'Role-based approvals',
    'Audit logs',
    'Shared delegation queue',
  ],
}

function hasEnv(env: NodeJS.ProcessEnv, key: string): boolean {
  return Boolean(env[key]?.trim())
}

function billingMode(secretKey?: string): BillingMode {
  if (!secretKey) return 'not_configured'
  if (secretKey.startsWith('sk_live_')) return 'live'
  if (secretKey.startsWith('sk_test_')) return 'test'
  return 'partial'
}

export function buildBillingStatus(env: NodeJS.ProcessEnv = process.env, now = new Date()): BillingStatus {
  const secretKeyConfigured = hasEnv(env, 'STRIPE_SECRET_KEY')
  const webhookSecretConfigured = hasEnv(env, 'STRIPE_WEBHOOK_SECRET')
  const priceIdsConfigured = hasEnv(env, 'STRIPE_PRICE_SOLO_PRO') || hasEnv(env, 'STRIPE_PRICE_TEAM')
  const customerPortalConfigured = hasEnv(env, 'STRIPE_CUSTOMER_PORTAL_URL')

  const blockers: string[] = []
  if (!secretKeyConfigured) blockers.push('STRIPE_SECRET_KEY fehlt.')
  if (!webhookSecretConfigured) blockers.push('STRIPE_WEBHOOK_SECRET fehlt.')
  if (!priceIdsConfigured) blockers.push('Mindestens eine STRIPE_PRICE_* Variable fehlt.')
  if (!customerPortalConfigured) blockers.push('STRIPE_CUSTOMER_PORTAL_URL fehlt fuer Self-Service Planwechsel.')

  const configuredCount = [
    secretKeyConfigured,
    webhookSecretConfigured,
    priceIdsConfigured,
    customerPortalConfigured,
  ].filter(Boolean).length

  const readiness: BillingReadiness =
    configuredCount === 4 ? 'ready' : configuredCount > 0 ? 'partial' : 'missing'

  return {
    provider: 'stripe',
    readiness,
    mode: billingMode(env.STRIPE_SECRET_KEY),
    generatedAt: now.toISOString(),
    stripe: {
      secretKeyConfigured,
      webhookSecretConfigured,
      priceIdsConfigured,
      customerPortalConfigured,
    },
    plans: [SOLO_LOCAL, SOLO_PRO, TEAM],
    blockers,
    nextActions: [
      'Stripe Produkt und Preise fuer Solo Pro und Team anlegen.',
      'Webhook Endpoint mit STRIPE_WEBHOOK_SECRET absichern.',
      'Customer Portal URL fuer Planwechsel und Kuendigung konfigurieren.',
      'Billing-Status spaeter tenant-aware in die Workspace Settings integrieren.',
    ],
  }
}
