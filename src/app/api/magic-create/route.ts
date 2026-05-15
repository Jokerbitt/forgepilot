import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { WorkItem } from '@/lib/models/work-item'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // SIMULATION: Magic Refine (Later this will be a real LLM call)
    // We analyze the prompt and generate a structured local ticket
    
    let riskClass: 'A' | 'B' | 'C' = 'C'
    let title = prompt
    if (prompt.toLowerCase().includes('urgent') || prompt.toLowerCase().includes('bug')) riskClass = 'A'
    else if (prompt.toLowerCase().includes('refactor') || prompt.toLowerCase().length > 50) riskClass = 'B'

    const newItem: WorkItem = {
      id: `LOCAL-${Math.floor(Math.random() * 10000)}`,
      source: 'linear', // Use linear as fallback for UI purposes, could be 'local' if added
      type: 'ticket',
      title: title.length > 60 ? title.substring(0, 60) + '...' : title,
      url: '#',
      projectId: 'LOCAL_IDEAS',
      status: 'todo',
      priority: riskClass === 'A' ? 1 : 2,
      blocked: false,
      risk: riskClass,
      aiDelegable: true,
      estimatedMinutes: Math.floor(Math.random() * 120) + 30,
      labels: ['magic-create', 'local'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const localItemsPath = path.join(process.cwd(), 'config', 'local-items.json')
    let localItems: WorkItem[] = []
    
    if (fs.existsSync(localItemsPath)) {
      localItems = JSON.parse(fs.readFileSync(localItemsPath, 'utf8'))
    }
    
    localItems.push(newItem)
    fs.writeFileSync(localItemsPath, JSON.stringify(localItems, null, 2))

    return NextResponse.json({ success: true, item: newItem })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create magic ticket', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
