export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { listSlashCommands, createSlashCommand } from '@/lib/skills/slash-command-manager'

export async function GET() {
  return NextResponse.json(listSlashCommands())
}

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { name, content, scope } = (body as Record<string, unknown>)
  if (typeof name !== 'string' || typeof content !== 'string') {
    return NextResponse.json({ error: 'name and content required' }, { status: 400 })
  }
  const cmd = createSlashCommand({
    name,
    content,
    scope: scope === 'global' ? 'global' : 'project',
  })
  return NextResponse.json(cmd, { status: 201 })
}
