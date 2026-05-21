import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { spawnParallelDelegations } from '@/lib/delegation-parallel'
import { parseBody, isValidationError } from '@/lib/validation/api'

const SpawnSchema = z.object({
  subTasks: z
    .array(
      z.object({
        title: z.string().min(1),
        goal: z.string().min(1),
        executionRoute: z.string().optional(),
      })
    )
    .min(1)
    .max(10),
  riskClass: z.enum(['A', 'B', 'C']).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const result = await parseBody(request, SpawnSchema)
  if (isValidationError(result)) return result

  try {
    const childIds = await spawnParallelDelegations({
      parentId: id,
      subTasks: result.subTasks,
      riskClass: result.riskClass,
    })
    return NextResponse.json({ childIds }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to spawn parallel delegations' }, { status: 500 })
  }
}
