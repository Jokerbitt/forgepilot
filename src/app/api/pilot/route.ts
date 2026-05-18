import { NextResponse } from 'next/server'
import { runPilot } from '@/lib/pilot/orchestrator'
import type { PilotInput } from '@/lib/pilot/orchestrator'

export async function POST(req: Request) {
  const body = await req.json() as Partial<PilotInput>

  if (!body.workItemId || !body.title || !body.goal) {
    return NextResponse.json(
      { error: 'workItemId, title, goal required' },
      { status: 400 },
    )
  }

  const result = await runPilot(body as PilotInput)
  const status = result.status === 'completed' ? 200 : 422
  return NextResponse.json(result, { status })
}
