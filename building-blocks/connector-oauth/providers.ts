/**
 * OAuth connector — minimal, dependency-free OAuth 2.0 (Authorization Code)
 * for Google and GitHub. Complements the credentials Auth block: same session,
 * extra sign-in options.
 *
 * Env per provider:
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
 *   OAUTH_REDIRECT_BASE (e.g. https://app.example.com)  — defaults to localhost
 */

export type OAuthProviderId = 'google' | 'github'

export interface OAuthUserProfile {
  providerId: OAuthProviderId
  externalId: string
  email: string
  name: string
  avatarUrl?: string
}

export interface OAuthProviderConfig {
  id: OAuthProviderId
  clientId: string
  clientSecret: string
  authorizeUrl: string
  tokenUrl: string
  scope: string
  /** Fetch a normalized profile given an access token. */
  fetchProfile(accessToken: string): Promise<OAuthUserProfile>
}

function redirectUri(provider: OAuthProviderId, env: NodeJS.ProcessEnv): string {
  const base = env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/auth/oauth/${provider}/callback`
}

export function getOAuthConfig(
  provider: OAuthProviderId,
  env: NodeJS.ProcessEnv = process.env,
): OAuthProviderConfig {
  switch (provider) {
    case 'google': {
      const clientId = env.GOOGLE_CLIENT_ID
      const clientSecret = env.GOOGLE_CLIENT_SECRET
      if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID/SECRET not set')
      return {
        id: 'google',
        clientId,
        clientSecret,
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'openid email profile',
        async fetchProfile(accessToken) {
          const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const p = (await res.json()) as { sub: string; email: string; name?: string; picture?: string }
          return { providerId: 'google', externalId: p.sub, email: p.email, name: p.name ?? p.email, avatarUrl: p.picture }
        },
      }
    }
    case 'github': {
      const clientId = env.GITHUB_CLIENT_ID
      const clientSecret = env.GITHUB_CLIENT_SECRET
      if (!clientId || !clientSecret) throw new Error('GITHUB_CLIENT_ID/SECRET not set')
      return {
        id: 'github',
        clientId,
        clientSecret,
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: 'read:user user:email',
        async fetchProfile(accessToken) {
          const headers = { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'app' }
          const u = (await (await fetch('https://api.github.com/user', { headers })).json()) as {
            id: number; login: string; name?: string; email?: string; avatar_url?: string
          }
          let email = u.email
          if (!email) {
            const emails = (await (await fetch('https://api.github.com/user/emails', { headers })).json()) as Array<{ email: string; primary: boolean }>
            email = emails.find(e => e.primary)?.email ?? emails[0]?.email
          }
          return { providerId: 'github', externalId: String(u.id), email: email ?? '', name: u.name ?? u.login, avatarUrl: u.avatar_url }
        },
      }
    }
  }
}

export function buildAuthorizeUrl(
  provider: OAuthProviderId,
  state: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const cfg = getOAuthConfig(provider, env)
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(provider, env),
    response_type: 'code',
    scope: cfg.scope,
    state,
  })
  return `${cfg.authorizeUrl}?${params.toString()}`
}

export async function exchangeCodeForToken(
  provider: OAuthProviderId,
  code: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const cfg = getOAuthConfig(provider, env)
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(provider, env),
    }),
  })
  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(`OAuth token exchange failed: ${data.error ?? 'no token'}`)
  return data.access_token
}
