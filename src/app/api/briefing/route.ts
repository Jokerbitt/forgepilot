export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { readStoredApiKeys } from '@/lib/connectors/config'

export interface LinearIssue {
  id: string
  title: string
  status: string
  priority: number
  url: string
}

export interface GitHubPR {
  number: number
  title: string
  url: string
  author: string
  updatedAt: string
  draft: boolean
}

export interface BriefingData {
  generatedAt: string
  linear: {
    inProgress: LinearIssue[]
    dueToday: LinearIssue[]
    blocked: LinearIssue[]
  }
  github: {
    openPRs: GitHubPR[]
    myPRs: GitHubPR[]
  }
  health: {
    overall: 'ok' | 'warn' | 'error'
    summary: string
  }
  delegations: {
    pendingApproval: number
    inProgress: number
    completedToday: number
  }
}

interface RawLinearIssue {
  id?: unknown
  title?: unknown
  status?: unknown
  priority?: unknown
  url?: unknown
  dueDate?: unknown
}

interface RawDelegation {
  status?: unknown
  completedAt?: unknown
}

interface RawGitHubPR {
  number?: unknown
  title?: unknown
  url?: unknown
  author?: unknown
  updatedAt?: unknown
  isDraft?: unknown
}

function getLinearData(): BriefingData['linear'] {
  const empty = { inProgress: [], dueToday: [], blocked: [] }
  try {
    if (!existsSync('config/linear-issues.json')) return empty
    const raw = JSON.parse(readFileSync('config/linear-issues.json', 'utf8')) as unknown
    if (!Array.isArray(raw)) return empty

    const today = new Date().toISOString().slice(0, 10)
    const inProgress: LinearIssue[] = []
    const dueToday: LinearIssue[] = []
    const blocked: LinearIssue[] = []

    for (const item of raw as RawLinearIssue[]) {
      const issue: LinearIssue = {
        id: String(item.id ?? ''),
        title: String(item.title ?? ''),
        status: String(item.status ?? ''),
        priority: typeof item.priority === 'number' ? item.priority : 0,
        url: String(item.url ?? ''),
      }
      const statusLower = issue.status.toLowerCase()
      if (statusLower.includes('in progress') || statusLower.includes('in_progress')) {
        inProgress.push(issue)
      }
      if (statusLower.includes('block')) {
        blocked.push(issue)
      }
      if (typeof item.dueDate === 'string' && item.dueDate.startsWith(today)) {
        dueToday.push(issue)
      }
    }
    return { inProgress, dueToday, blocked }
  } catch {
    return empty
  }
}

function getGitHubPRs(): BriefingData['github'] {
  const empty = { openPRs: [], myPRs: [] }
  try {
    const output = execSync(
      'gh pr list --json number,title,url,author,updatedAt,isDraft --limit 20',
      { encoding: 'utf8', timeout: 8000 }
    )
    const raw = JSON.parse(output) as unknown
    if (!Array.isArray(raw)) return empty

    const prs: GitHubPR[] = (raw as RawGitHubPR[]).map(item => ({
      number: typeof item.number === 'number' ? item.number : 0,
      title: String(item.title ?? ''),
      url: String(item.url ?? ''),
      author:
        typeof item.author === 'object' && item.author !== null && 'login' in item.author
          ? String((item.author as { login: unknown }).login)
          : String(item.author ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
      draft: Boolean(item.isDraft),
    }))

    // myPRs: authored by current git user (best effort)
    let myLogin = ''
    try {
      myLogin = execSync('gh api user --jq .login', { encoding: 'utf8', timeout: 5000 }).trim()
    } catch {
      // ignore — myPRs will be empty
    }

    const myPRs = myLogin ? prs.filter(pr => pr.author === myLogin) : []
    return { openPRs: prs, myPRs }
  } catch {
    return empty
  }
}

function getHealth(): BriefingData['health'] {
  const keys = readStoredApiKeys()
  const anthropicKey = process.env['ANTHROPIC_API_KEY'] ?? keys.ANTHROPIC_API_KEY
  const linearKey = process.env['LINEAR_API_KEY'] ?? keys.LINEAR_API_KEY

  const issues: string[] = []
  if (!anthropicKey) issues.push('Anthropic key fehlt')
  if (!linearKey) issues.push('Linear key fehlt')

  try {
    execSync('git --version', { stdio: 'ignore', timeout: 3000 })
  } catch {
    issues.push('Git nicht verfügbar')
  }

  const overall: 'ok' | 'warn' | 'error' = issues.length === 0 ? 'ok' : 'warn'
  const summary =
    issues.length === 0
      ? 'Alle Systeme betriebsbereit'
      : issues.join(', ')

  return { overall, summary }
}

function getDelegations(): BriefingData['delegations'] {
  const empty = { pendingApproval: 0, inProgress: 0, completedToday: 0 }
  try {
    if (!existsSync('config/delegations.json')) return empty
    const raw = JSON.parse(readFileSync('config/delegations.json', 'utf8')) as unknown
    if (!Array.isArray(raw)) return empty

    const today = new Date().toISOString().slice(0, 10)
    let pendingApproval = 0
    let inProgress = 0
    let completedToday = 0

    for (const item of raw as RawDelegation[]) {
      const status = String(item.status ?? '')
      if (status === 'pending' || status === 'approved') pendingApproval++
      if (status === 'running') inProgress++
      if (
        status === 'completed' &&
        typeof item.completedAt === 'string' &&
        item.completedAt.startsWith(today)
      ) {
        completedToday++
      }
    }
    return { pendingApproval, inProgress, completedToday }
  } catch {
    return empty
  }
}

export async function GET(): Promise<NextResponse<BriefingData>> {
  const [linear, github, health, delegations] = await Promise.all([
    Promise.resolve(getLinearData()),
    Promise.resolve(getGitHubPRs()),
    Promise.resolve(getHealth()),
    Promise.resolve(getDelegations()),
  ])

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    linear,
    github,
    health,
    delegations,
  })
}
