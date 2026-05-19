/**
 * Webhook Intake Endpoint — POST /api/webhooks/intake
 * Accepts external triggers from n8n, Zapier, or any HTTP client.
 * Optional Bearer token auth via WEBHOOK_SECRET env variable.
 * Body: { event: string; payload: unknown; source?: string }
 * Supported events: 'new-idea', 'new-task', 'delegation-trigger'
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { buildProjectBrief, saveProjectBrief } from '@/lib/project-briefs'
import type { IdeaIntakeInput } from '@/lib/models/project-brief'
import type { WorkItem } from '@/lib/models/work-item'

const SUPPORTED_EVENTS = ['new-idea', 'new-task', 'delegation-trigger'] as const
type SupportedEvent = typeof SUPPORTED_EVENTS[number]

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization')
  if (!auth) return false
  return auth === `Bearer ${secret}`
}

function handleNewIdea(payload: unknown): string {
  const p = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  const input: IdeaIntakeInput = {
    title: String(p.title ?? 'Webhook-Idee'),
    rawIdea: String(p.rawIdea ?? p.raw_idea ?? p.idea ?? p.description ?? ''),
    problemStatement: String(p.problemStatement ?? p.problem_statement ?? p.problem ?? 'Via Webhook eingegangen.'),
    targetAudience: String(p.targetAudience ?? p.target_audience ?? p.audience ?? 'Unbekannt'),
    desiredOutcome: String(p.desiredOutcome ?? p.desired_outcome ?? p.outcome ?? 'Zu definieren.'),
    constraints: Array.isArray(p.constraints) ? (p.constraints as string[]).map(String) : [],
    scope: 'minimal',
    researchMode: 'quick',
    privacyMode: 'local',
  }
  const brief = buildProjectBrief(input)
  saveProjectBrief(brief)
  return brief.id
}

function readLocalItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) return []
    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as WorkItem[]
  } catch { return [] }
}

function writeLocalItems(items: WorkItem[]): void {
  const dir = path.dirname(LOCAL_ITEMS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(LOCAL_ITEMS_FILE, JSON.stringify(items, null, 2), 'utf-8')
}

function handleNewTask(payload: unknown): string {
  const p = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const item: WorkItem = {
    id, source: 'local', type: 'ticket',
    title: String(p.title ?? 'Webhook-Task'),
    url: '',
    projectId: String(p.projectId ?? p.project_id ?? 'webhook'),
    status: 'backlog', priority: 2, blocked: false, risk: 'A',
    aiDelegable: true, updatedAt: now, createdAt: now, labels: ['webhook'],
  }
  const items = readLocalItems()
  items.push(item)
  writeLocalItems(items)
  return id
}

function handleDelegationTrigger(payload: unknown, source: string): string {
  const p = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  const ref = String(p.delegationId ?? p.delegation_id ?? p.id ?? crypto.randomUUID())
  console.info(`[webhook/intake] delegation-trigger received from=${source} ref=${ref}`)
  return ref
}

interface WebhookBody {
  event: string
  payload?: unknown
  source?: string
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: WebhookBody
  try {
    const raw = await request.json() as unknown
    if (typeof raw !== 'object' || raw === null) {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 })
    }
    body = raw as WebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 })
  }

  if (!body.event || typeof body.event !== 'string') {
    return NextResponse.json({ error: 'Missing required field: event' }, { status: 400 })
  }

  if (!(SUPPORTED_EVENTS as readonly string[]).includes(body.event)) {
    return NextResponse.json(
      { error: `Unsupported event: "${body.event}". Supported: ${SUPPORTED_EVENTS.join(', ')}` },
      { status: 422 },
    )
  }

  const event = body.event as SupportedEvent
  const payload = body.payload ?? {}
  const source = body.source ?? 'unknown'
  const processed: string[] = []

  switch (event) {
    case 'new-idea': {
      processed.push(`brief:${handleNewIdea(payload)}`)
      break
    }
    case 'new-task': {
      processed.push(`task:${handleNewTask(payload)}`)
      break
    }
    case 'delegation-trigger': {
      processed.push(`delegation-trigger:${handleDelegationTrigger(payload, source)}`)
      break
    }
  }

  return NextResponse.json({ received: true, processed }, { status: 200 })
}
