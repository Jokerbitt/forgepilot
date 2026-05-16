import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    const data = fs.readFileSync(DELEGATIONS_FILE, 'utf-8')
    return JSON.parse(data) as Delegation[]
  } catch (e) {
    return []
  }
}

function writeDelegations(delegations: Delegation[]) {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(DELEGATIONS_FILE, JSON.stringify(delegations, null, 2), 'utf-8')
}

export async function GET() {
  return NextResponse.json(readDelegations())
}

export async function POST(request: Request) {
  try {
    const delegation = await request.json() as Delegation
    const delegations = readDelegations()
    
    // Add or update
    const index = delegations.findIndex(d => d.id === delegation.id)
    if (index >= 0) {
      delegations[index] = { ...delegations[index], ...delegation, updatedAt: new Date().toISOString() }
    } else {
      delegations.push({
        ...delegation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
    
    writeDelegations(delegations)
    return NextResponse.json(delegation)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save delegation' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const delegations = readDelegations()
    const exists = delegations.some(d => d.id === id)
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    writeDelegations(delegations.filter(d => d.id !== id))
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete delegation' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const updates = await request.json() as Delegation[]
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Expected an array of delegations' }, { status: 400 })
    }
    
    const delegations = readDelegations()
    
    // Bulk update
    for (const update of updates) {
      const index = delegations.findIndex(d => d.id === update.id)
      if (index >= 0) {
        delegations[index] = { ...delegations[index], ...update, updatedAt: new Date().toISOString() }
      }
    }
    
    writeDelegations(delegations)
    return NextResponse.json({ success: true, count: updates.length })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to bulk update delegations' }, { status: 500 })
  }
}
