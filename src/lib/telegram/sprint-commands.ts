import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'

const CONFIG_DIR = path.join(process.cwd(), 'config')
const DELEGATIONS_FILE = path.join(CONFIG_DIR, 'delegations.json')
const LINEAR_ISSUES_FILE = path.join(CONFIG_DIR, 'linear-issues.json')
const CONNECTORS_FILE = path.join(CONFIG_DIR, 'connectors.json')

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LinearIssue {
  id: string
  title: string
  status: string
  description?: string
  priority?: number | string
}

interface ConnectorEntry {
  id: string
  name: string
  type?: string
  status?: string
  enabled?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readDelegationsRaw(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function readLinearIssues(): LinearIssue[] {
  try {
    return JSON.parse(fs.readFileSync(LINEAR_ISSUES_FILE, 'utf-8')) as LinearIssue[]
  } catch {
    return []
  }
}

function readConnectors(): ConnectorEntry[] {
  try {
    const raw = JSON.parse(fs.readFileSync(CONNECTORS_FILE, 'utf-8')) as unknown
    if (Array.isArray(raw)) return raw as ConnectorEntry[]
    if (raw && typeof raw === 'object' && 'connectors' in raw) {
      return (raw as { connectors: ConnectorEntry[] }).connectors
    }
    return []
  } catch {
    return []
  }
}

// ── Command handlers ──────────────────────────────────────────────────────────

/**
 * /sprint — sprint status from delegations + linear-issues (if available)
 */
export async function handleSprintCommand(): Promise<string> {
  try {
    const delegations = readDelegationsRaw()
    const linearIssues = readLinearIssues()

    // Use linear issues if available, fall back to delegations
    const hasLinear = linearIssues.length > 0

    if (hasLinear) {
      const done = linearIssues.filter(i =>
        /done|completed|merged|closed/i.test(i.status),
      ).length
      const inProgress = linearIssues.filter(i =>
        /in.?progress|review|started/i.test(i.status),
      ).length
      const todo = linearIssues.filter(i =>
        /todo|backlog|planned|open/i.test(i.status),
      ).length
      const total = linearIssues.length
      const percent = total > 0 ? Math.round((done / total) * 100) : 0

      const inProgressList = linearIssues
        .filter(i => /in.?progress|review|started/i.test(i.status))
        .slice(0, 5)
        .map(i => `• \`${i.id}\` ${i.title.slice(0, 60)}`)
        .join('\n')

      const bar = buildProgressBar(percent)

      return [
        `🏃 *Sprint Status*`,
        ``,
        `${bar} ${percent}%`,
        `✅ Done: ${done} | 🔄 In Progress: ${inProgress} | 📋 Todo: ${todo}`,
        ``,
        inProgressList ? `*In Progress:*\n${inProgressList}` : '_Kein Ticket in Bearbeitung._',
      ].join('\n')
    }

    // Fallback: delegations
    const done = delegations.filter(d => d.status === 'completed').length
    const inProgress = delegations.filter(d => d.status === 'running').length
    const todo = delegations.filter(d => d.status === 'pending' || d.status === 'approved').length
    const total = delegations.length
    const percent = total > 0 ? Math.round((done / total) * 100) : 0

    const bar = buildProgressBar(percent)

    const inProgressList = delegations
      .filter(d => d.status === 'running')
      .slice(0, 5)
      .map(d => `• ${(d.title ?? d.id).slice(0, 60)}`)
      .join('\n')

    return [
      `🏃 *Sprint Status* _(aus Delegations)_`,
      ``,
      `${bar} ${percent}%`,
      `✅ Done: ${done} | 🔄 Laufend: ${inProgress} | 📋 Todo: ${todo}`,
      ``,
      inProgressList ? `*Laufend:*\n${inProgressList}` : '_Keine laufenden Delegations._',
    ].join('\n')
  } catch {
    return 'Fehler beim Abrufen der Daten.'
  }
}

function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

/**
 * /ticket <id> — ticket details
 */
export async function handleTicketCommand(args: string[]): Promise<string> {
  try {
    const id = args[0]?.trim()
    if (!id) return '⚠️ Bitte Ticket-ID angeben: /ticket JOK-23'

    const issues = readLinearIssues()
    const issue = issues.find(i => i.id.toLowerCase() === id.toLowerCase())

    if (!issue) {
      // Also try delegations as fallback
      const delegations = readDelegationsRaw()
      const del = delegations.find(d => d.id === id)
      if (!del) return `Ticket nicht gefunden: \`${id}\``

      return [
        `📋 *${del.title ?? del.id}*`,
        `Status: ${del.status}`,
        `Route: ${del.executionRoute}`,
        del.contract?.goal ? `\n_${del.contract.goal.slice(0, 200)}_` : '',
      ].filter(Boolean).join('\n')
    }

    const desc = issue.description ? issue.description.slice(0, 200) : '_Keine Beschreibung_'
    const priorityLabel = issue.priority !== undefined ? ` · Priorität ${issue.priority}` : ''

    return [
      `📋 *${issue.id} — ${issue.title}*`,
      `Status: ${issue.status}${priorityLabel}`,
      ``,
      desc,
    ].join('\n')
  } catch {
    return 'Fehler beim Abrufen der Daten.'
  }
}

/**
 * /ci — CI/CD connector status
 */
export async function handleCiCommand(): Promise<string> {
  try {
    if (!fs.existsSync(CONNECTORS_FILE)) {
      return 'CI/CD Status: kein Connector konfiguriert'
    }

    const connectors = readConnectors()
    if (connectors.length === 0) {
      return 'CI/CD Status: kein Connector konfiguriert'
    }

    const ciConnectors = connectors.filter(c =>
      /github|gitlab|ci|cd|deploy|build/i.test(c.type ?? c.name ?? ''),
    )

    if (ciConnectors.length === 0) {
      return `⚙️ *Connectors* (${connectors.length} gesamt)\nKein CI/CD-Connector konfiguriert.`
    }

    const lines = ciConnectors.map(c => {
      const statusEmoji = c.enabled === false ? '⛔' : c.status === 'error' ? '❌' : '✅'
      return `${statusEmoji} *${c.name ?? c.id}*${c.status ? ` — ${c.status}` : ''}`
    })

    return [`🔧 *CI/CD Status*`, ...lines].join('\n')
  } catch {
    return 'Fehler beim Abrufen der Daten.'
  }
}

/**
 * /issues — open delegations sorted by priority (max 10)
 */
export async function handleIssuesCommand(): Promise<string> {
  try {
    const delegations = readDelegationsRaw()
    const open = delegations
      .filter(d => d.status === 'pending' || d.status === 'approved')
      .slice(0, 10)

    if (open.length === 0) return 'ℹ️ Keine offenen Delegations.'

    const lines = open.map((d, i) => {
      const riskBadge = d.contract?.riskClass ? ` [${d.contract.riskClass}]` : ''
      return `${i + 1}. \`${d.id}\` *${(d.title ?? d.id).slice(0, 55)}*${riskBadge}`
    })

    return [`📋 *Offene Delegations* (${open.length})`, ...lines].join('\n')
  } catch {
    return 'Fehler beim Abrufen der Daten.'
  }
}

/**
 * /health — system health check
 */
export async function handleHealthCommand(): Promise<string> {
  try {
    // Import health check logic directly
    const { GET } = await import('@/app/api/dev/health/route')
    const response = await GET()
    const data = await response.json() as {
      overall: string
      checks: Array<{ name: string; status: string; detail: string }>
    }

    const overallEmoji =
      data.overall === 'ok' ? '✅' : data.overall === 'warn' ? '⚠️' : '❌'

    const checkLines = data.checks.map(c => {
      const emoji = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'
      return `${emoji} *${c.name}*: ${c.detail.slice(0, 60)}`
    })

    return [
      `${overallEmoji} *System Health*`,
      `Overall: ${data.overall}`,
      ``,
      ...checkLines,
    ].join('\n')
  } catch {
    return 'Fehler beim Abrufen der Daten.'
  }
}
