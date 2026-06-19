/**
 * Jobs cron endpoint — GET/POST /api/cron/[job]
 * Runs a registered job by name, authorized by a Bearer CRON_SECRET.
 * Wire the schedule in your platform (vercel.json crons, or an external pinger).
 * Copy to: src/app/api/cron/[job]/route.ts
 */
import { NextResponse } from 'next/server'
import { getJob } from '@/lib/jobs/registry'

export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // allow in dev only
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function handle(req: Request, jobName: string) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const job = getJob(jobName)
  if (!job) {
    return NextResponse.json({ ok: false, error: `Unknown job: ${jobName}` }, { status: 404 })
  }
  const started = Date.now()
  try {
    const result = await job.run()
    return NextResponse.json({ ...result, job: jobName, ms: Date.now() - started, timestamp: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { ok: false, job: jobName, error: err instanceof Error ? err.message : 'job failed' },
      { status: 500 },
    )
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  return handle(req, (await params).job)
}

export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  return handle(req, (await params).job)
}
