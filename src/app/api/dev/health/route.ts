export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { readStoredApiKeys } from '@/lib/connectors/config'

export interface HealthCheck {
  name: string
  status: 'ok' | 'warn' | 'error'
  detail: string
}

export interface HealthReport {
  overall: 'ok' | 'warn' | 'error'
  executionMode: string
  checks: HealthCheck[]
  checkedAt: string
  n8nPayload: {
    description: string
    url: string
    headers: Record<string, string>
    body: Record<string, unknown>
  }
}

export async function GET(): Promise<NextResponse<HealthReport>> {
  const checks: HealthCheck[] = []
  const keys = readStoredApiKeys()

  // 1. Claude CLI
  try {
    const version = execSync('claude --version', { timeout: 3000 }).toString().trim()
    checks.push({ name: 'Claude CLI', status: 'ok', detail: version })
  } catch {
    checks.push({
      name: 'Claude CLI',
      status: 'warn',
      detail: 'nicht installiert — nur Simulation-Modus möglich',
    })
  }

  // 2. Anthropic API Key (env takes precedence over stored keys)
  const anthropicKey = process.env['ANTHROPIC_API_KEY'] ?? keys.ANTHROPIC_API_KEY
  checks.push({
    name: 'Anthropic API Key',
    status: anthropicKey ? 'ok' : 'warn',
    detail: anthropicKey ? 'konfiguriert' : 'ANTHROPIC_API_KEY nicht gesetzt — KI-Features deaktiviert',
  })

  // 3. Linear API Key
  const linearKey = process.env['LINEAR_API_KEY'] ?? keys.LINEAR_API_KEY
  checks.push({
    name: 'Linear API Key',
    status: linearKey ? 'ok' : 'warn',
    detail: linearKey ? 'konfiguriert' : 'LINEAR_API_KEY nicht gesetzt — Ticket-Erstellung deaktiviert',
  })

  // 4. GitHub CLI (gh)
  try {
    execSync('gh --version', { stdio: 'ignore', timeout: 3000 })
    checks.push({ name: 'GitHub CLI (gh)', status: 'ok', detail: 'installiert' })
  } catch {
    checks.push({
      name: 'GitHub CLI (gh)',
      status: 'warn',
      detail: 'gh nicht installiert — auto-merge nicht möglich',
    })
  }

  // 5. Git
  try {
    execSync('git --version', { stdio: 'ignore', timeout: 3000 })
    checks.push({ name: 'Git', status: 'ok', detail: 'verfügbar' })
  } catch {
    checks.push({ name: 'Git', status: 'warn', detail: 'git nicht gefunden' })
  }

  // 6. Config-Dateien
  const configFiles: Array<{ path: string; label: string }> = [
    { path: 'config/delegations.json', label: 'Config: delegations.json' },
    { path: 'config/project-briefs.json', label: 'Config: project-briefs.json' },
  ]
  for (const { path: filePath, label } of configFiles) {
    checks.push({
      name: label,
      status: existsSync(filePath) ? 'ok' : 'warn',
      detail: existsSync(filePath) ? 'vorhanden' : 'wird beim ersten Schreiben angelegt',
    })
  }

  // 7. Knowledge Cards Store
  checks.push({
    name: 'Knowledge Cards Store',
    status: existsSync('config/knowledge-store.json') ? 'ok' : 'warn',
    detail: existsSync('config/knowledge-store.json')
      ? 'vorhanden'
      : 'noch keine Knowledge Cards angelegt',
  })

  // 8. Intake endpoint
  checks.push({
    name: 'Intake Endpoint',
    status: 'ok',
    detail: 'POST /api/intake bereit',
  })

  const errorCount = checks.filter(c => c.status === 'error').length
  const warnCount = checks.filter(c => c.status === 'warn').length
  const overall: 'ok' | 'warn' | 'error' = errorCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'ok'

  const claudeOk = checks.find(c => c.name === 'Claude CLI')?.status === 'ok'
  const executionMode = claudeOk
    ? 'claude-cli (full agentic execution)'
    : anthropicKey
      ? 'claude-api (plan only — no code execution)'
      : 'simulation (no AI configured)'

  return NextResponse.json({
    overall,
    executionMode,
    checks,
    checkedAt: new Date().toISOString(),
    n8nPayload: {
      description: 'Example n8n payload for /api/intake',
      url: 'POST /api/intake',
      headers: {
        'Content-Type': 'application/json',
        'x-forgepilot-signature': '<hmac-or-omit-if-no-secret>',
      },
      body: {
        title: 'Test Delegation',
        description: 'Smoke test via n8n',
        autoDelegate: true,
        autoExecute: true,
      },
    },
  })
}
