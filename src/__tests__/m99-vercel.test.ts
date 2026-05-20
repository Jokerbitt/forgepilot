/**
 * M99 — Vercel Deployment Config tests
 * Tests vercel.json schema, cron route security, and deployment readiness.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

// ─── vercel.json schema ───────────────────────────────────────────────────────

describe('vercel.json', () => {
  let config: Record<string, unknown>

  beforeEach(() => {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'vercel.json'),
      'utf-8',
    )
    config = JSON.parse(raw) as Record<string, unknown>
  })

  it('exists and is valid JSON', () => {
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
  })

  it('specifies nextjs framework', () => {
    expect(config.framework).toBe('nextjs')
  })

  it('configures DSGVO retention cron job', () => {
    const crons = config.crons as Array<{ path: string; schedule: string }>
    expect(Array.isArray(crons)).toBe(true)
    expect(crons.length).toBeGreaterThanOrEqual(1)
    const retentionCron = crons.find((c) => c.path === '/api/cron/retention')
    expect(retentionCron).toBeDefined()
    expect(retentionCron?.schedule).toBe('0 2 * * *')
  })

  it('sets buildCommand and outputDirectory', () => {
    expect(config.buildCommand).toBeDefined()
    expect(config.outputDirectory).toBeDefined()
  })
})

// ─── Cron retention route ─────────────────────────────────────────────────────

describe('GET /api/cron/retention', () => {
  const makeRequest = (authHeader?: string) => {
    return new NextRequest('http://localhost:3000/api/cron/retention', {
      method: 'GET',
      headers: authHeader ? { authorization: authHeader } : {},
    })
  }

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.CRON_SECRET
  })

  it('exports a GET handler', async () => {
    const mod = await import('@/app/api/cron/retention/route')
    expect(typeof mod.GET).toBe('function')
  })

  it('returns 401 when CRON_SECRET is set and no auth header is provided', async () => {
    process.env.CRON_SECRET = 'test-secret-xyz'
    const { GET } = await import('@/app/api/cron/retention/route')
    const req = makeRequest()
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when auth header does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'test-secret-xyz'
    const { GET } = await import('@/app/api/cron/retention/route')
    const req = makeRequest('Bearer wrong-secret')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('accepts valid Bearer token matching CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'test-secret-xyz'
    const { GET } = await import('@/app/api/cron/retention/route')
    const req = makeRequest('Bearer test-secret-xyz')
    const res = await GET(req)
    // Should be 200 (cleanup may return 0 deleted in test env)
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; deletedCount: number; ranAt: string }
    expect(body.ok).toBe(true)
    expect(typeof body.deletedCount).toBe('number')
    expect(typeof body.ranAt).toBe('string')
  })

  it('runs without auth check when CRON_SECRET is not set (test env)', async () => {
    delete process.env.CRON_SECRET
    // NODE_ENV is 'test' in Vitest — no production guard active
    const { GET } = await import('@/app/api/cron/retention/route')
    const req = makeRequest()
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('returns ISO timestamp in ranAt field', async () => {
    process.env.CRON_SECRET = 'abc123'
    const { GET } = await import('@/app/api/cron/retention/route')
    const req = makeRequest('Bearer abc123')
    const res = await GET(req)
    if (res.status === 200) {
      const body = await res.json() as { ranAt: string }
      expect(() => new Date(body.ranAt).toISOString()).not.toThrow()
    }
  })

  it('runtime is nodejs (not edge)', async () => {
    const mod = await import('@/app/api/cron/retention/route')
    expect((mod as { runtime?: string }).runtime).toBe('nodejs')
  })
})

// ─── .env.example completeness ───────────────────────────────────────────────

describe('.env.example', () => {
  let envExample: string

  beforeEach(() => {
    envExample = fs.readFileSync(
      path.join(process.cwd(), '.env.example'),
      'utf-8',
    )
  })

  it('documents VERCEL_URL', () => {
    expect(envExample).toContain('VERCEL_URL')
  })

  it('documents CRON_SECRET', () => {
    expect(envExample).toContain('CRON_SECRET')
  })

  it('documents SENTRY_DSN', () => {
    expect(envExample).toContain('SENTRY_DSN')
  })

  it('documents OTEL exporter endpoint', () => {
    expect(envExample).toContain('OTEL_EXPORTER_OTLP_ENDPOINT')
  })
})
