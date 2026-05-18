import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation, AgentLog } from '@/lib/models/delegation'

export const dynamic = 'force-dynamic'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function writeDelegationsAtomic(delegations: Delegation[]) {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = DELEGATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

/**
 * Classify a terminal output line into an AgentLog type.
 */
function classifyLine(line: string): AgentLog['type'] {
  const l = line.trimStart()
  if (l.startsWith('$') || l.startsWith('> ') || l.startsWith('npm ') || l.startsWith('git ')) return 'command'
  if (l.startsWith('✅') || l.startsWith('✓') || /^\d+ passed/i.test(l)) return 'success'
  if (l.startsWith('❌') || l.startsWith('Error') || l.startsWith('error') || /failed|FAIL/i.test(l)) return 'error'
  if (l.startsWith('💭') || l.startsWith('Thinking') || l.startsWith('I ') || l.startsWith('Let me')) return 'thought'
  return 'info'
}

/**
 * POST /api/delegations/[id]/import-logs
 *
 * Accepts raw terminal output (string), splits into lines, classifies each
 * line as an AgentLog entry, and appends to the delegation's log array.
 * Useful for importing output from a claude CLI session run outside ForgePilot.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const delegations = readDelegations()
  const idx = delegations.findIndex(d => d.id === id)
  if (idx < 0) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const body = await req.json() as { output: string; status?: Delegation['status'] }
  if (!body.output || typeof body.output !== 'string') {
    return NextResponse.json({ error: 'output (string) required' }, { status: 400 })
  }

  const ts = new Date().toISOString()
  const newLogs: AgentLog[] = body.output
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.length > 0)
    .map(line => ({
      timestamp: ts,
      type: classifyLine(line),
      message: line.substring(0, 500),
    }))

  delegations[idx] = {
    ...delegations[idx],
    ...(body.status ? { status: body.status } : {}),
    logs: [...(delegations[idx].logs ?? []), ...newLogs],
    updatedAt: ts,
  }

  writeDelegationsAtomic(delegations)
  return NextResponse.json({ imported: newLogs.length })
}
