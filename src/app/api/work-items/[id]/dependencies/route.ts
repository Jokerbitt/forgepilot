import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { WorkItem } from '@/lib/models/work-item'

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')

export const dynamic = 'force-dynamic'

function readLocalWorkItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) {
      return []
    }
    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as WorkItem[]
  } catch {
    return []
  }
}

function writeLocalWorkItems(items: WorkItem[]): void {
  const dir = path.dirname(LOCAL_ITEMS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(LOCAL_ITEMS_FILE, JSON.stringify(items, null, 2))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const items = readLocalWorkItems()
  const item = items.find(i => i.id === params.id)

  if (!item) {
    return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: item.id,
    blockedBy: item.blockedBy ?? [],
    blocks: items.filter(i => i.blockedBy?.includes(item.id)).map(i => i.id),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json() as { blockedBy: string[] }

    if (!Array.isArray(body.blockedBy)) {
      return NextResponse.json(
        { error: 'blockedBy must be an array of strings' },
        { status: 400 },
      )
    }

    const items = readLocalWorkItems()
    const itemIndex = items.findIndex(i => i.id === params.id)

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    // Validate that all blockers exist and remove duplicates
    const blockerIds: string[] = []
    const seenBlockers = new Map<string, boolean>()
    for (const bid of body.blockedBy) {
      if (!seenBlockers.has(bid)) {
        if (!items.some(i => i.id === bid)) {
          return NextResponse.json(
            { error: `Blocker work item ${bid} not found` },
            { status: 404 },
          )
        }
        blockerIds.push(bid)
        seenBlockers.set(bid, true)
      }
    }

    // Prevent circular dependencies
    const itemId = items[itemIndex]!.id
    for (const bid of blockerIds) {
      if (bid === itemId) {
        return NextResponse.json(
          { error: 'An item cannot be blocked by itself' },
          { status: 400 },
        )
      }
    }

    // Check for circular dependencies (A blocks B, B blocks C, C cannot block A)
    const checkCircularDependency = (targetId: string, sourceId: string, visited: Map<string, boolean>): boolean => {
      if (visited.has(sourceId)) return false
      visited.set(sourceId, true)

      const sourceItem = items.find(i => i.id === sourceId)
      if (!sourceItem?.blockedBy) return false

      for (const blockerId of sourceItem.blockedBy) {
        if (blockerId === targetId) return true
        if (checkCircularDependency(targetId, blockerId, visited)) return true
      }

      return false
    }

    for (const bid of blockerIds) {
      const visited = new Map<string, boolean>()
      if (checkCircularDependency(itemId, bid, visited)) {
        return NextResponse.json(
          { error: 'This dependency would create a circular reference' },
          { status: 400 },
        )
      }
    }

    items[itemIndex]!.blockedBy = blockerIds
    items[itemIndex]!.blocked = blockerIds.length > 0
    writeLocalWorkItems(items)

    return NextResponse.json({
      id: items[itemIndex]!.id,
      blockedBy: items[itemIndex]!.blockedBy,
      message: 'Dependencies updated successfully',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to update dependencies',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json() as { blockerId: string }

    const items = readLocalWorkItems()
    const itemIndex = items.findIndex(i => i.id === params.id)

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    const item = items[itemIndex]!
    if (!item.blockedBy?.includes(body.blockerId)) {
      return NextResponse.json(
        { error: 'This item is not blocked by the specified work item' },
        { status: 404 },
      )
    }

    item.blockedBy = item.blockedBy.filter(id => id !== body.blockerId)
    item.blocked = item.blockedBy.length > 0
    writeLocalWorkItems(items)

    return NextResponse.json({
      id: item.id,
      blockedBy: item.blockedBy,
      message: 'Blocker removed successfully',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to remove blocker',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
