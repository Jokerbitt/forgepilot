/**
 * OAuth callback route — GET /api/auth/oauth/[provider]/callback
 * Verifies CSRF state, exchanges code → token → profile, upserts the user,
 * and creates a session. ADAPT the marked sections to your auth/db blocks.
 *
 * Copy to: src/app/api/auth/oauth/[provider]/callback/route.ts
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForToken, getOAuthConfig, type OAuthProviderId } from '@/lib/oauth/providers'
// ADAPT: import your own session + user helpers
// import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/session'
// import { upsertOAuthUser } from '@/lib/db/users'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  if (provider !== 'google' && provider !== 'github') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const jar = await cookies()
  const expectedState = jar.get(`oauth_state_${provider}`)?.value
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL('/login?error=oauth_state', req.url))
  }

  try {
    const token = await exchangeCodeForToken(provider as OAuthProviderId, code)
    const profile = await getOAuthConfig(provider as OAuthProviderId).fetchProfile(token)
    if (!profile.email) {
      return NextResponse.redirect(new URL('/login?error=oauth_no_email', req.url))
    }

    // ADAPT START — wire to your db + session blocks:
    // const user = await upsertOAuthUser(profile)
    // const sessionToken = await createSessionToken({ userId: user.id, email: user.email })
    const res = NextResponse.redirect(new URL('/dashboard', req.url))
    // res.cookies.set(SESSION_COOKIE, sessionToken, {
    //   httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
    //   secure: process.env.NODE_ENV === 'production',
    // })
    // ADAPT END

    res.cookies.delete(`oauth_state_${provider}`)
    return res
  } catch {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url))
  }
}
