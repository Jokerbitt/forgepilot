import { runSaaSAudit } from '@/lib/readiness/saas-audit'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const report = runSaaSAudit(process.env)
  return Response.json(report)
}
