import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { WorkItem, RiskClass } from '@/lib/models/work-item'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode } = body // 'magic' or 'manual'
    
    let newItem: WorkItem

    if (mode === 'manual') {
      // Manual ticket creation
      const { title, description, projectId, milestone, riskClass, priority, estimate } = body
      if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

      newItem = {
        id: `LOCAL-${Date.now().toString().slice(-4)}`,
        source: 'local' as any, // casting as we haven't updated all types strictly
        type: 'ticket',
        title,
        url: '#',
        projectId: projectId || 'LOCAL_IDEAS',
        milestone,
        status: 'todo',
        priority: priority !== undefined ? priority : 2,
        blocked: false,
        risk: riskClass || 'C',
        aiDelegable: true,
        estimatedMinutes: estimate || 60,
        labels: ['manual', 'local'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    } else if (mode === 'delegation') {
      const { prompt, existingTicketId } = body
      if (!prompt || !existingTicketId) {
        return NextResponse.json({ error: 'Prompt and existingTicketId are required' }, { status: 400 })
      }

      let riskClass: RiskClass = 'C'
      if (prompt.toLowerCase().includes('urgent') || prompt.toLowerCase().includes('bug')) riskClass = 'A'
      else if (prompt.toLowerCase().includes('refactor') || prompt.toLowerCase().length > 50) riskClass = 'B'

      const newDelegation = {
        id: `DEL-${Date.now().toString().slice(-4)}`,
        status: 'pending',
        executionRoute: 'local-agent',
        costEstimateUsd: Math.random() * 0.5 + 0.1,
        contract: {
          id: `CON-${Date.now().toString().slice(-4)}`,
          workItemId: existingTicketId,
          goal: prompt,
          context: "Direct delegation from Magic Create",
          definitionOfDone: ["Task implemented according to prompt"],
          riskClass,
          maxBudgetUsd: 1.0,
          allowedTools: ["read_file", "write_file", "search_code"],
          branchStrategy: 'feature',
          requiresApproval: true,
          privacyMode: 'local',
          createdAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const delegationsPath = path.join(process.cwd(), 'config', 'delegations.json')
      let delegations: any[] = []
      
      if (fs.existsSync(delegationsPath)) {
        delegations = JSON.parse(fs.readFileSync(delegationsPath, 'utf8'))
      }
      
      delegations.push(newDelegation)
      fs.writeFileSync(delegationsPath, JSON.stringify(delegations, null, 2))

      return NextResponse.json({ success: true, item: newDelegation })
    } else {
      // Magic create
      const { prompt, projectId, milestone } = body
      if (!prompt) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
      }

      let riskClass: RiskClass = 'C'
      let title = prompt
      if (prompt.toLowerCase().includes('urgent') || prompt.toLowerCase().includes('bug')) riskClass = 'A'
      else if (prompt.toLowerCase().includes('refactor') || prompt.toLowerCase().length > 50) riskClass = 'B'

      newItem = {
        id: `LOCAL-${Date.now().toString().slice(-4)}`,
        source: 'local' as any,
        type: 'ticket',
        title: title.length > 60 ? title.substring(0, 60) + '...' : title,
        url: '#',
        projectId: projectId || 'LOCAL_IDEAS',
        milestone,
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
      { error: 'Failed to create ticket', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
