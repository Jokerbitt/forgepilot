/**
 * Jobs connector — a tiny registry of named, scheduled jobs.
 * Each job is a pure async handler; the cron route runs them by name.
 * Destination: src/lib/jobs/registry.ts
 */

export interface JobResult {
  ok: boolean
  detail?: string
  stats?: Record<string, number>
}

export interface Job {
  name: string
  /** Cron expression (documentation only — the platform scheduler enforces it). */
  schedule: string
  run(): Promise<JobResult>
}

const jobs = new Map<string, Job>()

export function registerJob(job: Job): void {
  jobs.set(job.name, job)
}

export function getJob(name: string): Job | undefined {
  return jobs.get(name)
}

export function listJobs(): Job[] {
  return [...jobs.values()]
}

// ── Example: register your jobs here (or in their own modules imported once) ──
// registerJob({
//   name: 'expire-invitations',
//   schedule: '0 * * * *',
//   async run() {
//     const n = await prisma.invitation.updateMany({
//       where: { status: 'pending', expiresAt: { lt: new Date() } },
//       data: { status: 'expired' },
//     })
//     return { ok: true, stats: { expired: n.count } }
//   },
// })
