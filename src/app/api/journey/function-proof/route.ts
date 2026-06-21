export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/function-proof
 * Body: { url: string, appName?: string, routes?: string[] }
 * Returns: ProofReport (does the running app actually respond?)
 *
 * Phase 4.1 — function proof. Probes the key routes of a running/deployed app
 * (e.g. the URL from /api/deploy) and returns a plain-German verdict. Goes
 * beyond "build green" to "nachweislich erreichbar".
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { normalizeRoutes, isProbeOk, summarizeProof, type ProbeResult } from '@/lib/journey/function-proof'

const PROBE_TIMEOUT_MS = 8000

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { url?: string; appName?: string; routes?: string[] }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const rawUrl = body.url?.trim()
  if (!rawUrl) return NextResponse.json({ error: 'url ist erforderlich' }, { status: 400 })

  let base: URL
  try {
    base = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`)
  } catch {
    return NextResponse.json({ error: 'Ungültige URL' }, { status: 400 })
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return NextResponse.json({ error: 'Nur http(s)-URLs werden unterstützt' }, { status: 400 })
  }

  const routes = normalizeRoutes(body.routes)
  const results: ProbeResult[] = []
  for (const route of routes) {
    const target = new URL(route, base).toString()
    try {
      const res = await fetch(target, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
      results.push({ route, status: res.status, ok: isProbeOk(res.status) })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ route, status: 0, ok: false, error: /timeout|abort/i.test(msg) ? 'Zeitüberschreitung' : 'nicht erreichbar' })
    }
  }

  return NextResponse.json(summarizeProof(body.appName ?? 'Die App', results))
}
