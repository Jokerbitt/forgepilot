/**
 * Request-id helpers for API route handlers.
 *
 * The middleware (`src/middleware.ts`) sets `x-request-id` on every request
 * before any route handler runs. Use these helpers to:
 *
 *   * extract the id reliably from `NextRequest` / `Request` / `Headers`
 *   * derive a Pino child logger that bakes `requestId` into every line
 *
 * Example:
 *
 *   import { loggerForRequest } from '@/lib/observability/request-id'
 *
 *   export async function POST(req: NextRequest) {
 *     const log = loggerForRequest(req, 'delegations.create')
 *     log.info({ event: 'received' }, 'payload arrived')
 *     …
 *   }
 *
 * All subsequent log lines from `log.*` will carry `requestId` and `route`,
 * so the operator can grep one ID through the whole pipeline.
 */

import type { Logger } from 'pino'
import { logger as rootLogger } from '@/lib/logger'

export const REQUEST_ID_HEADER = 'x-request-id'

type HeaderSource =
  | Headers
  | { headers: Headers }
  | { headers: { get: (name: string) => string | null } }

function readHeader(source: HeaderSource | undefined): string | null {
  if (!source) return null
  if (source instanceof Headers) return source.get(REQUEST_ID_HEADER)
  if ('headers' in source && source.headers) {
    return source.headers.get(REQUEST_ID_HEADER) ?? null
  }
  return null
}

/**
 * Extract the request id from anything that exposes a `.headers.get(name)`.
 * Returns `'unknown'` when none is set — never throws, so logging paths stay
 * robust even if middleware was bypassed (test runner, CLI script, etc.).
 */
export function getRequestId(source: HeaderSource | undefined): string {
  return readHeader(source) ?? 'unknown'
}

/**
 * Build a Pino child logger seeded with `requestId` and optional `route`.
 * Use this at the top of every route handler — every downstream log line then
 * carries the id automatically.
 */
export function loggerForRequest(
  source: HeaderSource | undefined,
  route?: string,
  base: Logger = rootLogger,
): Logger {
  const bindings: Record<string, string> = { requestId: getRequestId(source) }
  if (route) bindings.route = route
  return base.child(bindings)
}
