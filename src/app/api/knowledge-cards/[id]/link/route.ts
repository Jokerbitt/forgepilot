import { NextRequest, NextResponse } from 'next/server'
import { linkCards } from '@/lib/knowledge/graph'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { z } from 'zod'

const LinkSchema = z.object({
  targetId: z.string(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const result = await parseBody(request, LinkSchema)
  if (isValidationError(result)) return result

  const linkResult = await linkCards(id, result.targetId)
  if (!linkResult.success) {
    return NextResponse.json({ error: linkResult.reason }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
