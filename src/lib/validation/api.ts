/**
 * API Validation Helper — M94
 *
 * Parses and validates incoming request bodies using Zod schemas.
 * Returns typed data on success, or a NextResponse(400) with field errors.
 *
 * Usage in an API route:
 *
 *   const result = await parseBody(request, CreateDelegationSchema)
 *   if (result instanceof NextResponse) return result  // validation failed
 *   const { title, contract } = result                // typed & validated
 */

import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'

export type ParseResult<T> = T | NextResponse

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the validated data, or a 400 NextResponse with structured errors.
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const result = schema.safeParse(raw)
  if (result.success) return result.data

  return NextResponse.json(
    {
      error:  'Validation failed',
      fields: formatZodErrors(result.error),
    },
    { status: 400 },
  )
}

/**
 * Parse and validate URL search params against a Zod schema.
 * Returns the validated data, or a 400 NextResponse with structured errors.
 */
export function parseParams<T>(
  params: Record<string, string | string[] | undefined>,
  schema: ZodSchema<T>,
): ParseResult<T> {
  const result = schema.safeParse(params)
  if (result.success) return result.data

  return NextResponse.json(
    {
      error:  'Invalid query parameters',
      fields: formatZodErrors(result.error),
    },
    { status: 400 },
  )
}

/**
 * Convert Zod error to a flat { fieldName: errorMessage } record.
 */
function formatZodErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    if (!fields[key]) {
      fields[key] = issue.message
    }
  }
  return fields
}

/**
 * Type guard: check if parseBody/parseParams returned a validation error.
 */
export function isValidationError(result: unknown): result is NextResponse {
  return result instanceof NextResponse
}
