/**
 * Tests for API validation helpers (M94)
 *
 * Ensures that parseBody() and parseParams() correctly:
 * - Parse valid input and return typed data
 * - Return 400 responses with structured field errors on validation failure
 * - Handle invalid JSON, missing required fields, type mismatches
 */

import { NextRequest } from 'next/server'
import { describe, it, expect } from 'vitest'
import { parseBody, parseParams, isValidationError } from './api'
import { WorkItemImportSchema, DelegationContractSchema, ProviderConfigSchema, ExecuteLoopEvidenceRunSchema } from './schemas'
import { z } from 'zod'

// Helper: Create a NextRequest with JSON body
function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('parseBody', () => {
  describe('valid input', () => {
    it('parses valid body and returns typed data', async () => {
      const req = makeReq({ csv: 'id,title\n1,Task 1' })
      const result = await parseBody(req, WorkItemImportSchema)
      expect(isValidationError(result)).toBe(false)
      expect(result).toEqual({ csv: 'id,title\n1,Task 1' })
    })

    it('applies schema defaults', async () => {
      const req = makeReq({
        goal: 'This is a goal with sufficient length to pass validation',
        // riskClass omitted → should default to 'A'
      })
      const result = await parseBody(req, DelegationContractSchema)
      expect(isValidationError(result)).toBe(false)
      expect(result).toHaveProperty('riskClass', 'A')
    })
  })

  describe('validation errors', () => {
    it('returns 400 with structured fields when required field is missing', async () => {
      const req = makeReq({}) // csv is required
      const result = await parseBody(req, WorkItemImportSchema)
      expect(isValidationError(result)).toBe(true)
      const json = await (result as any).json()
      expect(json).toHaveProperty('error', 'Validation failed')
      expect(json).toHaveProperty('fields')
      expect(json.fields).toHaveProperty('csv')
      expect(typeof json.fields.csv).toBe('string')
    })

    it('returns 400 when csv field is empty string (min(1) required)', async () => {
      const req = makeReq({ csv: '' })
      const result = await parseBody(req, WorkItemImportSchema)
      expect(isValidationError(result)).toBe(true)
      const json = await (result as any).json()
      expect(json.fields.csv).toContain('required')
    })

    it('returns 400 when field has wrong type', async () => {
      const req = makeReq({ csv: 123 }) // csv should be string
      const result = await parseBody(req, WorkItemImportSchema)
      expect(isValidationError(result)).toBe(true)
      const json = await (result as any).json()
      expect(json.fields).toHaveProperty('csv')
    })

    it('includes multiple field errors in response', async () => {
      const req = makeReq({
        goal: 'short', // too short (min 10)
        riskClass: 'INVALID', // not in enum
      })
      const result = await parseBody(req, DelegationContractSchema)
      expect(isValidationError(result)).toBe(true)
      const json = await (result as any).json()
      expect(Object.keys(json.fields).length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('invalid JSON', () => {
    it('returns 400 when body is not valid JSON', async () => {
      const req = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        body: 'not json {',
      })
      const result = await parseBody(req, WorkItemImportSchema)
      expect(isValidationError(result)).toBe(true)
      const json = await (result as any).json()
      expect(json.error).toBe('Invalid JSON body')
    })
  })
})

describe('parseParams', () => {
  const QuerySchema = z.object({
    delegationId: z.string().min(1, 'delegationId required'),
  })

  describe('valid input', () => {
    it('parses valid query parameters', () => {
      const result = parseParams({ delegationId: 'abc123' }, QuerySchema)
      expect(isValidationError(result)).toBe(false)
      expect(result).toEqual({ delegationId: 'abc123' })
    })
  })

  describe('validation errors', () => {
    it('returns 400 when required param is missing', () => {
      const result = parseParams({}, QuerySchema)
      expect(isValidationError(result)).toBe(true)
      const json = (result as any).json() // for NextResponse, call json() directly
      expect(json).toBeDefined()
    })

    it('returns 400 when param value is empty', () => {
      const result = parseParams({ delegationId: '' }, QuerySchema)
      expect(isValidationError(result)).toBe(true)
    })
  })
})

describe('isValidationError', () => {
  it('returns true for NextResponse', async () => {
    const req = makeReq({})
    const result = await parseBody(req, WorkItemImportSchema)
    expect(isValidationError(result)).toBe(true)
  })

  it('returns false for valid data', async () => {
    const req = makeReq({ csv: 'data' })
    const result = await parseBody(req, WorkItemImportSchema)
    expect(isValidationError(result)).toBe(false)
  })
})

describe('human-friendly schema messages', () => {
  it('explains provider base URLs with local and cloud examples', () => {
    const result = ProviderConfigSchema.safeParse({
      id: 'ollama',
      name: 'Ollama',
      type: 'ollama',
      baseUrl: 'not-a-url',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('http://localhost:11434')
  })

  it('explains PR URLs with a GitHub pull request example', () => {
    const result = ExecuteLoopEvidenceRunSchema.safeParse({
      title: 'Real value loop evidence',
      prUrl: 'not-a-url',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('/pull/123')
  })
})
