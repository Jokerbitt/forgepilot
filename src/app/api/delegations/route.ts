export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import {
  createDelegationRepository,
  getDelegationStorageMode,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { reapStaleDelegations } from '@/lib/delegations/watchdog'

// Zod schema for creating/updating a delegation via POST
const DelegationInputSchema = z.object({
  id:              z.string().optional(),
  title:           z.string().max(200).optional(),
  status:          z.enum(['pending', 'approved', 'running', 'completed', 'failed', 'cancelled']).optional(),
  contract: z.object({
    goal:             z.string().min(5, 'Goal required'),
    riskClass:        z.enum(['A', 'B', 'C']).default('A'),
    privacyMode:      z.enum(['local', 'private-cloud', 'public']).default('local'),
    requiresApproval: z.boolean().default(false),
    maxBudgetUsd:     z.number().min(0).optional(),
    filePatterns:     z.array(z.string()).optional(),
    skillCategory:    z.string().optional(),
    acceptanceCriteria: z.array(z.string()).optional(),
    context:          z.string().optional(),
  }).passthrough(),
  autoOrchestrate: z.boolean().optional(),
  dataSubjectId:   z.string().optional(),
}).passthrough()  // allow extra fields from existing clients

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function backfillTitle(d: Delegation): Delegation {
  if (d.title) return d
  return { ...d, title: d.contract.goal.slice(0, 80) }
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false
  return ['1', 'true', 'yes'].includes(value.toLowerCase())
}

function isUrgentDelegation(d: Delegation): boolean {
  return (
    d.status === 'failed'
    || d.contract.riskClass === 'C'
    || (d.status === 'pending' && d.contract.requiresApproval)
    || (d.priority ?? 0) >= 8
  )
}

export async function GET(request: NextRequest) {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  await reapStaleDelegations(repo)

  // Optional status filter: ?statuses=pending,approved,running
  const statusesParam = request.nextUrl.searchParams.get('statuses')
  const statusFilter = statusesParam
    ? (statusesParam.split(',').map(s => s.trim()) as Parameters<typeof repo.listByStatus>[0])
    : undefined

  let delegations = (await repo.listByStatus(statusFilter)).map(backfillTitle)

  // Optional briefId filter: ?briefId=xxx → only delegations linked to that brief
  const briefIdParam = request.nextUrl.searchParams.get('briefId')
  if (briefIdParam) {
    delegations = delegations.filter(
      d => d.briefId === briefIdParam || d.contract.workItemId === briefIdParam
    )
  }

  // Optional urgent filter: ?urgent=true → only delegations needing operator attention
  if (parseBooleanParam(request.nextUrl.searchParams.get('urgent'))) {
    delegations = delegations.filter(isUrgentDelegation)
  }

  // Optional limit: ?limit=50
  const limit = request.nextUrl.searchParams.get('limit')
  if (limit) {
    const n = parseInt(limit, 10)
    if (!isNaN(n) && n > 0) delegations = delegations.slice(0, n)
  }

  return NextResponse.json(delegations)
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request, DelegationInputSchema)
    if (isValidationError(body)) return body
    const delegation = body as unknown as Delegation

    // Ensure title is set
    const withTitle: Delegation = {
      ...delegation,
      title: delegation.title || delegation.contract.goal.slice(0, 80),
    }

    // Auto-approve Risk-A delegations that don't require human approval
    const autoApproved: Delegation =
      withTitle.contract.riskClass === 'A' &&
      !withTitle.contract.requiresApproval &&
      withTitle.status === 'pending'
        ? { ...withTitle, status: 'approved', updatedAt: new Date().toISOString() }
        : withTitle

    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const storageMode = getDelegationStorageMode()

    if (
      autoApproved.id
      && (storageMode === 'postgres' || storageMode === 'dual')
      && !UUID_PATTERN.test(autoApproved.id)
    ) {
      return NextResponse.json(
        { error: 'Delegation id must be a UUID when PostgreSQL storage is active.' },
        { status: 400 },
      )
    }

    // If delegation already exists (has an id matching an existing one), update it
    if (autoApproved.id) {
      const existing = await repo.findById(autoApproved.id)
      if (existing) {
        const updated = await repo.update(autoApproved.id, {
          ...autoApproved,
        })
        if (updated) {
          // Store rotation: cap at 200 after update
          await trimStore(repo)
          return NextResponse.json(updated)
        }
      }
    }

    // Create new delegation via repository
    const created = await repo.create(autoApproved)

    // Store rotation: cap at 200, dropping oldest terminal-status entries first
    await trimStore(repo)

    return NextResponse.json(created)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save delegation' }, { status: 500 })
  }
}

async function trimStore(repo: ReturnType<typeof createDelegationRepository>): Promise<void> {
  const MAX_DELEGATIONS = 200
  const MIN_RECENT_TERMINAL_TO_KEEP = 20
  const all = await repo.listByStatus()
  if (all.length <= MAX_DELEGATIONS) return

  const terminalStatuses: Array<'completed' | 'failed' | 'cancelled'> = ['completed', 'failed', 'cancelled']
  const terminal = all.filter(d => (terminalStatuses as string[]).includes(d.status))
  const overflow = all.length - MAX_DELEGATIONS
  const deletableTerminal = terminal
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, Math.max(terminal.length - MIN_RECENT_TERMINAL_TO_KEEP, 0))
  const toDelete = deletableTerminal.slice(0, overflow)

  for (const d of toDelete) {
    await repo.delete(d.id)
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const statuses = searchParams.get('statuses')
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

    if (id) {
      // Single delete by id
      const deleted = await repo.delete(id)
      if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ success: true, deleted: 1 })
    }

    if (statuses) {
      // Bulk delete by status list (comma-separated)
      const statusList = statuses.split(',').map(s => s.trim()) as Delegation['status'][]
      const toDelete = await repo.listByStatus(statusList)
      for (const d of toDelete) {
        await repo.delete(d.id)
      }
      return NextResponse.json({ success: true, deleted: toDelete.length })
    }

    return NextResponse.json({ error: 'Missing id or statuses param' }, { status: 400 })
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

    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

    // Bulk update
    for (const update of updates) {
      await repo.update(update.id, update)
    }

    return NextResponse.json({ success: true, count: updates.length })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to bulk update delegations' }, { status: 500 })
  }
}
