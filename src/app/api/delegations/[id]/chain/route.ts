import { NextRequest, NextResponse } from 'next/server'
import { linkDelegations } from '@/lib/delegation-chain'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { z } from 'zod'

const ChainSchema = z.object({
  nextId: z.string().uuid(),
  autoChain: z.boolean().optional().default(false),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const result = await parseBody(request, ChainSchema)
  if (isValidationError(result)) return result

  try {
    const { prev, next } = await linkDelegations(id, result.nextId, { autoChain: result.autoChain })
    if (!prev || !next) {
      return NextResponse.json({ error: 'Delegation not found' }, { status: 404 })
    }
    return NextResponse.json({ prev, next })
  } catch {
    return NextResponse.json({ error: 'Failed to link delegations' }, { status: 500 })
  }
}
