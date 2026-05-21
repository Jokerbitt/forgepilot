export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { WorkItem, WorkItemStatus } from '@/lib/models/work-item'

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')
const STATUS_OVERRIDES_FILE = path.join(process.cwd(), 'config', 'work-item-status-overrides.json')

const StatusPatchSchema = z.object({
  status: z.enum(['backlog', 'todo', 'in-progress', 'in-review', 'done', 'cancelled']),
})

interface StatusOverride {
  id: string
  status: WorkItemStatus
  updatedAt: string
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, value: unknown): void {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = StatusPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 400 })
  }

  const now = new Date().toISOString()
  const localItems = readJson<WorkItem[]>(LOCAL_ITEMS_FILE, [])
  const localIndex = localItems.findIndex(item => item.id === id)

  if (localIndex >= 0) {
    const updated = {
      ...localItems[localIndex],
      status: parsed.data.status,
      updatedAt: now,
    }
    localItems[localIndex] = updated
    writeJson(LOCAL_ITEMS_FILE, localItems)
    return NextResponse.json(updated)
  }

  const overrides = readJson<StatusOverride[]>(STATUS_OVERRIDES_FILE, [])
  const existingIndex = overrides.findIndex(item => item.id === id)
  const override: StatusOverride = { id, status: parsed.data.status, updatedAt: now }

  if (existingIndex >= 0) {
    overrides[existingIndex] = override
  } else {
    overrides.push(override)
  }

  writeJson(STATUS_OVERRIDES_FILE, overrides)
  return NextResponse.json(override)
}
