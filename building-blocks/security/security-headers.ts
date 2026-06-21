// Recommended HTTP security headers for a Next.js app.
// Destination: src/lib/security/security-headers.ts

/**
 * A conservative starter Content-Security-Policy. Tighten per app:
 * - Replace 'unsafe-inline' on style-src with nonces/hashes where possible.
 * - Next.js needs 'unsafe-inline' for some runtime scripts unless you wire up
 *   a nonce via middleware; prefer a nonce-based policy in production.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

export interface SecurityHeader {
  key: string;
  value: string;
}

/** Recommended security headers, ready to spread into a response or config. */
export const securityHeaders: ReadonlyArray<SecurityHeader> = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
];

/** Same headers as a plain object, e.g. for `new Headers()` or NextResponse. */
export function securityHeadersObject(): Record<string, string> {
  return Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));
}

/*
 * Wire these into next.config.ts so every route gets them:
 *
 *   import type { NextConfig } from 'next';
 *   import { securityHeaders } from './src/lib/security/security-headers';
 *
 *   const nextConfig: NextConfig = {
 *     async headers() {
 *       return [
 *         {
 *           source: '/:path*',
 *           headers: [...securityHeaders],
 *         },
 *       ];
 *     },
 *   };
 *
 *   export default nextConfig;
 */
