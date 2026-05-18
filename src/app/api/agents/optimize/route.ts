import { NextResponse } from 'next/server'
import { scoreWork } from '@/lib/agents/work-quality'
import { recordOutcome, getDriftWarnings } from '@/lib/agents/skill-evolver'
import type { AtomicTask } from '@/lib/agents/atomic-task'
import type { AgentType } from '@/lib/agents/agent-skills'

export async function POST(req: Request) {
  const body = await req.json() as {
    task: AtomicTask
    agentType: AgentType
    testsPassed: boolean
    typeErrorCount: number
    lintErrorCount: number
    filesChanged: number
    retryCount: number
    durationMinutes: number
  }

  const result = scoreWork({
    task: body.task,
    testsPassed: body.testsPassed,
    typeErrorCount: body.typeErrorCount,
    lintErrorCount: body.lintErrorCount,
    filesChanged: body.filesChanged,
    retryCount: body.retryCount ?? 0,
    durationMinutes: body.durationMinutes ?? 0,
  })

  recordOutcome(body.agentType, body.task.skillCategory, result)

  const warnings = getDriftWarnings()

  return NextResponse.json({ result, driftWarnings: warnings })
}

export async function GET() {
  const warnings = getDriftWarnings()
  return NextResponse.json({ warnings })
}
