// `withApiGuards` — wraps a Next.js route handler with error handling, body-size
// caps, and optional auth + rate-limit hooks.
// Destination: src/lib/security/api-handler.ts

import { NextResponse } from 'next/server';

export interface ApiError {
  error: string;
  /** Optional machine-readable code for clients to branch on. */
  code?: string;
}

/** Outcome of an auth or rate-limit check. `ok: false` short-circuits the handler. */
export type GuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string; code?: string };

export interface ApiGuardOptions {
  /** Reject bodies larger than this many bytes (default 1 MiB). */
  maxBodyBytes?: number;
  /** Optional auth check. Return `{ ok: false }` to reject (typically 401). */
  auth?: (request: Request) => GuardResult | Promise<GuardResult>;
  /** Optional rate-limit check. Return `{ ok: false }` to reject (typically 429). */
  rateLimit?: (request: Request) => GuardResult | Promise<GuardResult>;
}

type Handler = (request: Request) => Promise<Response> | Response;

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

function jsonError(body: ApiError, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

/**
 * Wraps a route handler with a consistent guard pipeline:
 *   1. Body-size cap (via Content-Length).
 *   2. Optional rate-limit hook.
 *   3. Optional auth hook.
 *   4. try/catch around the handler -> typed JSON 500 (never leaks stack traces).
 *
 * Usage:
 *   export const POST = withApiGuards(async (req) => { ... }, { auth, rateLimit });
 */
export function withApiGuards(
  handler: Handler,
  opts: ApiGuardOptions = {},
): (request: Request) => Promise<NextResponse> {
  const maxBodyBytes = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async (request: Request): Promise<NextResponse> => {
    try {
      // 1. Body-size cap. We check the declared Content-Length up front; for
      // streamed bodies without a length, enforce the cap when you read it.
      const contentLength = request.headers.get('content-length');
      if (contentLength !== null) {
        const declared = Number.parseInt(contentLength, 10);
        if (!Number.isNaN(declared) && declared > maxBodyBytes) {
          return jsonError(
            { error: 'Request body too large', code: 'BODY_TOO_LARGE' },
            413,
          );
        }
      }

      // 2. Rate limit.
      if (opts.rateLimit) {
        const result = await opts.rateLimit(request);
        if (!result.ok) {
          return jsonError({ error: result.error, code: result.code }, result.status);
        }
      }

      // 3. Auth.
      if (opts.auth) {
        const result = await opts.auth(request);
        if (!result.ok) {
          return jsonError({ error: result.error, code: result.code }, result.status);
        }
      }

      // 4. Run the handler.
      const response = await handler(request);
      return response instanceof NextResponse
        ? response
        : new NextResponse(response.body, response);
    } catch (err: unknown) {
      // Log full detail server-side; return a generic message to the client.
      console.error('[api] unhandled error:', errorMessage(err));
      return jsonError(
        { error: 'Internal server error', code: 'INTERNAL' },
        500,
      );
    }
  };
}
