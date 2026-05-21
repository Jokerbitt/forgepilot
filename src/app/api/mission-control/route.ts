export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import type { Delegation } from '@/lib/models/delegation'

const CONFIG_DIR = path.join(process.cwd(), 'config')
const DELEGATIONS_FILE = path.join(CONFIG_DIR, 'delegations.json')
const LINEAR_ISSUES_FILE = path.join(CONFIG_DIR, 'linear-issues.json')

export interface MissionControlData {
  generatedAt: string
  focus: {
    nextBestAction: { title: string; reason: string; issueId?: string; href: string } | null
    blockers: Array<{ id: string; title: string; blockedCount: number; href: string }>
    urgentApprovals: Array<{ id: string; title: string; riskClass: string; href: string }>
  }
  pulse: {
    delegationsRunning: number
    delegationsPendingApproval: number
    delegationsCompletedToday: number
    openPRs: number
  }
  health: {
    status: 'ok' | 'warn' | 'error'
    topIssue: string | null
  }
}

function readDelegations(): Delegation[] {
  try {
    if (!fs.existsSync(DELEGATIONS_FILE)) return []
    const parsed = JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as unknown
    return Array.isArray(parsed) ? (parsed as Delegation[]) : []
  } catch {
    return []
  }
}

interface LinearIssue {
  id: string
  title: string
  blocked?: boolean
  blockedBy?: string[]
}

function readLinearIssues(): LinearIssue[] {
  try {
    if (!fs.existsSync(LINEAR_ISSUES_FILE)) return []
    const parsed = JSON.parse(fs.readFileSync(LINEAR_ISSUES_FILE, 'utf-8')) as unknown
    return Array.isArray(parsed) ? (parsed as LinearIssue[]) : []
  } catch {
    return []
  }
}

function countOpenPRs(): number {
  try {
    const output = execSync('gh pr list --json number --limit 50', {
      timeout: 5000,
      encoding: 'utf-8',
    })
    const parsed = JSON.parse(output) as unknown[]
    return parsed.length
  } catch {
    return 0
  }
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function computeHealth(delegations: Delegation[]): { status: 'ok' | 'warn' | 'error'; topIssue: string | null } {
  const issues: string[] = []

  if (!process.env['ANTHROPIC_API_KEY']) {
    issues.push('Anthropic API key missing')
  }

  try {
    fs.accessSync(CONFIG_DIR, fs.constants.R_OK)
  } catch {
    issues.push('config/ directory not readable')
  }

  const failedCount = delegations.filter(d => d.status === 'failed').length
  if (failedCount >= 3) {
    issues.push(`${failedCount} failed delegations`)
  }

  if (issues.length === 0) return { status: 'ok', topIssue: null }
  if (issues.length === 1 && issues[0]?.includes('key missing')) {
    return { status: 'warn', topIssue: issues[0] ?? null }
  }
  return { status: issues.length > 1 ? 'error' : 'warn', topIssue: issues[0] ?? null }
}

async function computeNextBestAction(): Promise<MissionControlData['focus']['nextBestAction']> {
  try {
    const { prioritizeItems } = await import('@/lib/nba-engine/prioritizer')

    // Read work items directly from the local-items config file (fail-open)
    const LOCAL_ITEMS_FILE = path.join(CONFIG_DIR, 'local-items.json')
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) return null

    const raw = JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as unknown
    const workItems = Array.isArray(raw) ? (raw as import('@/lib/models/work-item').WorkItem[]) : []
    if (workItems.length === 0) return null

    const recs = prioritizeItems(workItems)
    if (!recs || recs.length === 0) return null

    const top = [...recs].sort((a, b) => b.score.total - a.score.total)[0]
    if (!top) return null

    return {
      title: top.workItem.title,
      reason: top.rationale,
      issueId: top.workItem.id,
      href: top.workItem.url ?? `/delegations?item=${top.workItem.id}`,
    }
  } catch {
    return null
  }
}

export async function GET(): Promise<NextResponse<MissionControlData>> {
  const delegations = readDelegations()
  const linearIssues = readLinearIssues()

  // --- focus.nextBestAction ---
  const nextBestAction = await computeNextBestAction()

  // --- focus.blockers ---
  const blockedIssues = linearIssues
    .filter(i => i.blocked === true || (Array.isArray(i.blockedBy) && i.blockedBy.length > 0))
    .slice(0, 3)
    .map(i => ({
      id: i.id,
      title: i.title,
      blockedCount: Array.isArray(i.blockedBy) ? i.blockedBy.length : 1,
      href: `/linear/${i.id}`,
    }))

  // --- focus.urgentApprovals ---
  const urgentApprovals = delegations
    .filter(
      d =>
        d.status === 'pending' &&
        (d.contract.riskClass === 'C'),
    )
    .slice(0, 3)
    .map(d => ({
      id: d.id,
      title: d.title,
      riskClass: d.contract.riskClass,
      href: `/delegations/${d.id}`,
    }))

  // --- pulse ---
  const delegationsRunning = delegations.filter(d => d.status === 'running').length
  const delegationsPendingApproval = delegations.filter(d => d.status === 'pending').length
  const delegationsCompletedToday = delegations.filter(
    d => d.status === 'completed' && isToday(d.updatedAt ?? d.createdAt),
  ).length
  const openPRs = countOpenPRs()

  // --- health ---
  const health = computeHealth(delegations)

  const data: MissionControlData = {
    generatedAt: new Date().toISOString(),
    focus: {
      nextBestAction,
      blockers: blockedIssues,
      urgentApprovals,
    },
    pulse: {
      delegationsRunning,
      delegationsPendingApproval,
      delegationsCompletedToday,
      openPRs,
    },
    health,
  }

  return NextResponse.json(data)
}
