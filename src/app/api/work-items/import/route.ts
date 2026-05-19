import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { parseCSV } from '@/lib/work-items/csv-parser'
import type { WorkItem } from '@/lib/models/work-item'

export const dynamic = 'force-dynamic'

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')

function readLocalItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) return []
    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as WorkItem[]
  } catch {
    return []
  }
}

function writeLocalItems(items: WorkItem[]): void {
  const dir = path.dirname(LOCAL_ITEMS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(LOCAL_ITEMS_FILE, JSON.stringify(items, null, 2), 'utf-8')
}

function mapPriority(priority: string): 0 | 1 | 2 | 3 | 4 {
  switch (priority) {
    case 'critical': return 0
    case 'high': return 1
    case 'medium': return 2
    case 'low': return 3
    default: return 2
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('csv' in body) ||
    typeof (body as Record<string, unknown>).csv !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing required field: csv (string)' }, { status: 400 })
  }

  const csvInput = (body as { csv: string }).csv
  let parsed
  try {
    parsed = parseCSV(csvInput)
  } catch {
    return NextResponse.json({ error: 'Failed to parse CSV' }, { status: 400 })
  }

  if (parsed.length === 0) return NextResponse.json({ imported: 0, items: [] })

  const now = new Date().toISOString()
  const newItems: WorkItem[] = parsed.map(p => ({
    id: crypto.randomUUID(),
    source: 'local',
    type: 'ticket',
    title: p.title,
    url: '',
    projectId: '',
    status: 'todo',
    priority: mapPriority(p.priority),
    blocked: false,
    risk: 'A',
    aiDelegable: true,
    ...(p.description ? { labels: [p.description] } : {}),
    createdAt: now,
    updatedAt: now,
  }))

  const existing = readLocalItems()
  writeLocalItems([...existing, ...newItems])

  return NextResponse.json({ imported: newItems.length, items: newItems })
}
