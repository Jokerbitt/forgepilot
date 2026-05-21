export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getComments, addComment } from '@/lib/delegations/comments-store'
import { parseBody } from '@/lib/validation/api'

const AddCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  author: z.enum(['user', 'agent', 'system']).default('user'),
  authorName: z.string().min(1).max(100).default('User'),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const comments = getComments(id)
  return NextResponse.json({ comments })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const result = await parseBody(request, AddCommentSchema)
  if (result instanceof NextResponse) return result

  const comment = addComment({
    delegationId: id,
    author: result.author,
    authorName: result.authorName,
    body: result.body,
  })

  return NextResponse.json({ comment }, { status: 201 })
}
