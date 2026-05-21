/**
 * Next.js middleware — assigns a stable `x-request-id` to every inbound request.
 *
 * If the caller already supplied one (e.g. n8n, an upstream proxy, or a load
 * test), we honour it; otherwise we mint a fresh UUID. The header is mirrored
 * back on the response so curl users and the browser DevTools can correlate.
 *
 * Runs in the Edge runtime — no Node-only APIs, no AsyncLocalStorage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import {
  isForgePilotAuthEnabled,
  isAuthConfigured,
  shouldProtectPath,
  isPublicOperationalPath,
} from '@/lib/auth/config'

/** Header name read on the request and echoed on the response. */
export const REQUEST_ID_HEADER = 'x-request-id'

/** Match the canonical UUID v4 / v7 / nanoid-ish shape — 8–64 alnum + hyphens. */
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/

/** Generate a UUID v4 in the Edge runtime (crypto.randomUUID is available). */
function newRequestId(): string {
  // crypto.randomUUID exists on Edge Runtime and in Node ≥ 19.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: 22-char base36 from random bytes — only used if randomUUID is gone.
  return Array.from({ length: 22 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
}

function requestIdFor(request: NextRequest): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER)
  return incoming && VALID_REQUEST_ID.test(incoming) ? incoming : newRequestId()
}

function nextWithRequestId(request: NextRequest): NextResponse {
  const requestId = requestIdFor(request)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

function decorateResponse(request: NextRequest, response: NextResponse): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestIdFor(request))
  return response
}

/** Maximum allowed request body size (10 MB). Applied to POST / PUT / PATCH only. */
const MAX_BODY_SIZE = 10 * 1024 * 1024

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Reject oversized bodies early, before auth or business logic.
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return new NextResponse('Request too large', { status: 413 })
    }
  }

  if (!isForgePilotAuthEnabled()) {
    return nextWithRequestId(request)
  }

  const { pathname } = request.nextUrl

  // If auth is enabled but not yet configured → redirect to setup page
  if (
    !isAuthConfigured() &&
    pathname !== '/setup' &&
    !isPublicOperationalPath(pathname) &&
    !pathname.startsWith('/_next/')
  ) {
    const setupUrl = request.nextUrl.clone()
    setupUrl.pathname = '/setup'
    return decorateResponse(request, NextResponse.redirect(setupUrl))
  }

  if (!shouldProtectPath(pathname)) {
    return nextWithRequestId(request)
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (token) return nextWithRequestId(request)

  if (pathname.startsWith('/api/')) {
    return decorateResponse(
      request,
      NextResponse.json({ error: 'Unauthorized', authRequired: true }, { status: 401 }),
    )
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search)
  return decorateResponse(request, NextResponse.redirect(loginUrl))
}

/**
 * Run on every route except static assets, Next internals, and the public
 * favicon. Webhooks, API routes, and pages all get a request id.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
