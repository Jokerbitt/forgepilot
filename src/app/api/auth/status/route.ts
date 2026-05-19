import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

export interface AuthStatusResult {
  loggedIn: boolean
  authMethod: string
  subscriptionType: string
  email?: string
}

interface ClaudeAuthStatus {
  loggedIn?: boolean
  authMethod?: string
  apiProvider?: string
  email?: string
  orgId?: string
  orgName?: string
  subscriptionType?: string
}

function readClaudeAuthStatus(): AuthStatusResult {
  try {
    // Strip ANTHROPIC_API_KEY so claude reports the session auth (Max subscription),
    // not the API key. If ANTHROPIC_API_KEY is present, claude reports apiKeySource
    // and returns null for subscriptionType/email.
    const { ANTHROPIC_API_KEY: _stripped, ...baseEnv } = process.env
    const raw = execSync('claude auth status', {
      timeout: 5000,
      encoding: 'utf-8',
      env: baseEnv,
    }).trim()

    if (!raw) {
      return { loggedIn: false, authMethod: 'none', subscriptionType: 'none' }
    }

    const parsed = JSON.parse(raw) as ClaudeAuthStatus

    if (!parsed.loggedIn) {
      return { loggedIn: false, authMethod: parsed.authMethod ?? 'none', subscriptionType: 'none' }
    }

    const result: AuthStatusResult = {
      loggedIn: true,
      authMethod: parsed.authMethod ?? 'unknown',
      subscriptionType: parsed.subscriptionType ?? 'unknown',
    }
    if (parsed.email) result.email = parsed.email
    return result
  } catch {
    return { loggedIn: false, authMethod: 'none', subscriptionType: 'none' }
  }
}

export async function GET() {
  return NextResponse.json(readClaudeAuthStatus())
}
