export const AUTH_DISABLED_ENV = 'FORGEPILOT_AUTH_DISABLED'
export const DEFAULT_ADMIN_EMAIL = 'admin@forgepilot.local'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const PRODUCTION_ENV_VALUES = new Set(['production', 'prod'])

function isTruthy(value: unknown): boolean {
  return TRUE_VALUES.has(String(value ?? '').trim().toLowerCase())
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = String(env.NODE_ENV ?? '').trim().toLowerCase()
  const vercelEnv = String(env.VERCEL_ENV ?? '').trim().toLowerCase()
  return PRODUCTION_ENV_VALUES.has(nodeEnv) || PRODUCTION_ENV_VALUES.has(vercelEnv)
}

export function isAuthBypassAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthy(env[AUTH_DISABLED_ENV]) && !isProductionRuntime(env)
}

export function isForgePilotAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isAuthBypassAllowed(env)
}

const PLACEHOLDER_VALUES = new Set([
  'generate-with-openssl-rand-base64-32',
  'change-me-before-deploy',
  'your-secret-here',
  'secret',
  'password',
  'changeme',
  '',
])

function isPlaceholder(value: string | undefined): boolean {
  return !value || PLACEHOLDER_VALUES.has(value.trim().toLowerCase())
}

export function isAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.FORGEPILOT_ADMIN_PASSWORD && env.NEXTAUTH_SECRET)
}

/** Returns true only when both secrets are set AND are not placeholder/weak values. */
export function isAuthSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  const password = env.FORGEPILOT_ADMIN_PASSWORD ?? ''
  const secret = env.NEXTAUTH_SECRET ?? ''
  if (isPlaceholder(password) || isPlaceholder(secret)) return false
  if (password.length < 12) return false
  if (secret.length < 32) return false
  return true
}

/** Returns a list of human-readable security issues with the current auth config. */
export function getAuthSecurityIssues(env: NodeJS.ProcessEnv = process.env): string[] {
  const issues: string[] = []
  const password = env.FORGEPILOT_ADMIN_PASSWORD ?? ''
  const secret = env.NEXTAUTH_SECRET ?? ''

  if (!password) issues.push('FORGEPILOT_ADMIN_PASSWORD is not set')
  else if (isPlaceholder(password)) issues.push('FORGEPILOT_ADMIN_PASSWORD is a placeholder — set a real password')
  else if (password.length < 12) issues.push('FORGEPILOT_ADMIN_PASSWORD must be at least 12 characters')

  if (!secret) issues.push('NEXTAUTH_SECRET is not set')
  else if (isPlaceholder(secret)) issues.push('NEXTAUTH_SECRET is a placeholder — run: openssl rand -base64 32')
  else if (secret.length < 32) issues.push('NEXTAUTH_SECRET must be at least 32 characters')

  const nextauthUrl = env.NEXTAUTH_URL ?? ''
  if (isProductionRuntime(env) && !nextauthUrl.startsWith('https://')) {
    issues.push('NEXTAUTH_URL must use https:// in production')
  }

  return issues
}

export function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/auth/')
}

export function isLoginPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/')
}

export function isSetupPath(pathname: string): boolean {
  return pathname === '/setup' || pathname.startsWith('/setup/')
}

export function isPublicOperationalPath(pathname: string): boolean {
  return (
    pathname === '/api/health' ||
    pathname === '/api/ready' ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname === '/api/telegram/webhook' ||
    pathname === '/api/sentry/webhook'
  )
}

export function shouldProtectPath(pathname: string): boolean {
  if (
    isAuthApiPath(pathname) ||
    isLoginPath(pathname) ||
    isSetupPath(pathname) ||
    isPublicOperationalPath(pathname)
  ) {
    return false
  }
  if (pathname.startsWith('/api/')) return true
  return !pathname.startsWith('/_next/')
}
