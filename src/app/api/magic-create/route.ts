import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { WorkItem, RiskClass } from '@/lib/models/work-item'
import type { Delegation } from '@/lib/models/delegation'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import { shouldRequireApproval } from '@/lib/nba-engine/approval-policy'

interface MagicCreateBody {
  mode?: 'manual' | 'delegation' | 'magic'
  title?: string
  description?: string
  projectId?: string
  milestone?: string
  riskClass?: RiskClass
  priority?: WorkItem['priority']
  estimate?: number
  prompt?: string
  existingTicketId?: string
}

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')
const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function estimateMinutesFromText(text: string): number {
  const lengthScore = Math.min(120, Math.max(30, text.trim().length * 2))
  return Math.round(lengthScore / 15) * 15
}

function estimateCostFromText(text: string): number {
  return Number((Math.min(1, Math.max(0.1, text.trim().length / 240))).toFixed(2))
}

function inferRiskClass(text: string): RiskClass {
  const normalized = text.toLowerCase()
  if (normalized.includes('production') || normalized.includes('secret') || normalized.includes('delete')) {
    return 'C'
  }
  if (normalized.includes('urgent') || normalized.includes('bug') || normalized.includes('refactor')) {
    return 'B'
  }
  return 'A'
}

function estimateScoreForRisk(riskClass: RiskClass): number {
  if (riskClass === 'A') return 90
  if (riskClass === 'B') return 70
  return 40
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MagicCreateBody
    const { mode } = body // 'magic' or 'manual'
    
    let newItem: WorkItem

    if (mode === 'manual') {
      // Manual ticket creation
      const { title, description, projectId, milestone, riskClass, priority, estimate } = body
      if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

      newItem = {
        id: `LOCAL-${Date.now().toString().slice(-4)}`,
        source: 'local',
        type: 'ticket',
        title,
        url: '#',
        projectId: projectId || 'LOCAL_IDEAS',
        milestone,
        status: 'todo',
        priority: priority !== undefined ? priority : 2,
        blocked: false,
        risk: riskClass || 'A',
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

      const riskClass = inferRiskClass(prompt)
      const config = getNBAConfig()
      const requiresApproval = shouldRequireApproval({
        approvalMode: config.approvalMode,
        riskClass,
        scoreTotal: estimateScoreForRisk(riskClass),
        autopilotMinScore: config.autopilotMinScore,
        autopilotMaxRiskClass: config.autopilotMaxRiskClass,
      })

      const newDelegation: Delegation = {
        id: `DEL-${Date.now().toString().slice(-4)}`,
        title: prompt.slice(0, 80),
        status: requiresApproval ? 'pending' : 'approved',
        executionRoute: 'local-agent',
        costEstimateUsd: estimateCostFromText(prompt),
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
          requiresApproval,
          privacyMode: 'local',
          createdAt: new Date().toISOString()
        },
        logs: requiresApproval
          ? [{ timestamp: new Date().toISOString(), type: 'info', message: 'Delegation wartet auf Freigabe.' }]
          : [{ timestamp: new Date().toISOString(), type: 'success', message: `Auto-Freigabe durch ${config.approvalMode}-Modus.` }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      let delegations: Delegation[] = []

      if (fs.existsSync(DELEGATIONS_FILE)) {
        delegations = JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf8')) as Delegation[]
      }

      delegations.push(newDelegation)
      const dir = path.dirname(DELEGATIONS_FILE)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const tmpDel = DELEGATIONS_FILE + '.tmp'
      fs.writeFileSync(tmpDel, JSON.stringify(delegations, null, 2))
      fs.renameSync(tmpDel, DELEGATIONS_FILE)

      return NextResponse.json({ success: true, item: newDelegation })
    } else {
      // Magic create
      const { prompt, projectId, milestone } = body
      if (!prompt) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
      }

      const riskClass = inferRiskClass(prompt)
      const title = prompt

      newItem = {
        id: `LOCAL-${Date.now().toString().slice(-4)}`,
        source: 'local',
        type: 'ticket',
        title: title.length > 60 ? title.substring(0, 60) + '...' : title,
        url: '#',
        projectId: projectId || 'LOCAL_IDEAS',
        milestone,
        status: 'todo',
        priority: riskClass === 'C' ? 1 : riskClass === 'B' ? 2 : 3,
        blocked: false,
        risk: riskClass,
        aiDelegable: true,
        estimatedMinutes: estimateMinutesFromText(prompt),
        labels: ['magic-create', 'local'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }

    let localItems: WorkItem[] = []

    if (fs.existsSync(LOCAL_ITEMS_FILE)) {
      localItems = JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf8')) as WorkItem[]
    }

    localItems.push(newItem)
    const itemsDir = path.dirname(LOCAL_ITEMS_FILE)
    if (!fs.existsSync(itemsDir)) fs.mkdirSync(itemsDir, { recursive: true })
    const tmpItems = LOCAL_ITEMS_FILE + '.tmp'
    fs.writeFileSync(tmpItems, JSON.stringify(localItems, null, 2))
    fs.renameSync(tmpItems, LOCAL_ITEMS_FILE)

    return NextResponse.json({ success: true, item: newItem })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create ticket', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
