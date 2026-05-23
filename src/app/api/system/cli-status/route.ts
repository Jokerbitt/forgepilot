import { execSync } from 'child_process'
import { NextResponse } from 'next/server'
import { readStoredApiKeys } from '@/lib/connectors/config'

export const dynamic = 'force-dynamic'

interface CliStatusResponse {
  claudeCliAvailable: boolean
  claudeCliVersion: string | null
  claudeApiKeySet: boolean
  activeMode: 'claude-cli' | 'claude-api' | 'simulation'
  setupUrl: string
}

function detectClaudeVersion(): string | null {
  try {
    const out = execSync('claude --version', { encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] })
    return out.trim().split('\n')[0] ?? null
  } catch {
    return null
  }
}

export async function GET(): Promise<NextResponse<CliStatusResponse>> {
  const version = detectClaudeVersion()
  const claudeCliAvailable = version !== null
  const { ANTHROPIC_API_KEY } = readStoredApiKeys()
  const claudeApiKeySet = Boolean(ANTHROPIC_API_KEY?.trim())

  const activeMode: CliStatusResponse['activeMode'] = claudeCliAvailable
    ? 'claude-cli'
    : claudeApiKeySet
      ? 'claude-api'
      : 'simulation'

  return NextResponse.json({
    claudeCliAvailable,
    claudeCliVersion: version,
    claudeApiKeySet,
    activeMode,
    setupUrl: 'https://claude.ai/code',
  })
}
