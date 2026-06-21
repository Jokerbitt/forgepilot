/**
 * OAuth start route — GET /api/auth/oauth/[provider]
 * Redirects the user to the provider's consent screen with a CSRF state cookie.
 *
 * Copy to: src/app/api/auth/oauth/[provider]/route.ts
 */
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { buildAuthorizeUrl, type OAuthProviderId } from '@/lib/oauth/providers'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  if (provider !== 'google' && provider !== 'github') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }
  const state = randomBytes(16).toString('hex')
  const url = buildAuthorizeUrl(provider as OAuthProviderId, state)
  const res = NextResponse.redirect(url)
  res.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600, secure: process.env.NODE_ENV === 'production',
  })
  return res
}
