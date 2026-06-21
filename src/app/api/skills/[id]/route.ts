export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSkill, updateSkill, deleteSkill } from '@/lib/skills/prompt-skill-registry'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const skill = getSkill(id)
  if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(skill)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const updated = updateSkill(id, body as Parameters<typeof updateSkill>[1])
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = deleteSkill(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
