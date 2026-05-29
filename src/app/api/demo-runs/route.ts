import { buildTodoPlannerDemoRun } from './lib'

export const dynamic = 'force-dynamic'

export async function GET() {
  const demoRun = buildTodoPlannerDemoRun(new Date().toISOString())
  return Response.json({
    ok: true,
    demoRun,
  })
}
