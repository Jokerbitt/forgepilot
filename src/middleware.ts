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

export function middleware(request: NextRequest): NextResponse {
  const incoming = request.headers.get(REQUEST_ID_HEADER)
  const requestId = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : newRequestId()

  // Forward the (possibly minted) header to downstream handlers …
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)

  // … and mirror it back to the client.
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
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
