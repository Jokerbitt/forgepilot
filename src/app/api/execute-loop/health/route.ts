export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { getCachedOrShallowRunnerReadiness } from '@/lib/system/runner-readiness'

export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {}
  const runnerReadiness = getCachedOrShallowRunnerReadiness()

  // Check 1: Claude CLI available
  try {
    const version = execSync('claude --version', { timeout: 3000 }).toString().trim()
    checks.claudeCli = {
      ok: runnerReadiness.claude.headlessReady,
      detail: runnerReadiness.claude.headlessReady
        ? runnerReadiness.claude.detail
        : `${version} installiert, aber Headless-Ausfuehrung noch nicht bestaetigt.`,
    }
  } catch {
    checks.claudeCli = { ok: false, detail: 'claude CLI not found in PATH' }
  }

  // Check 2: Codex CLI available
  try {
    const version = execSync('codex --version', { timeout: 3000 }).toString().trim()
    checks.codexCli = {
      ok: runnerReadiness.codex.headlessReady,
      detail: runnerReadiness.codex.headlessReady
        ? runnerReadiness.codex.detail
        : `${version || 'codex CLI'} installiert, aber Headless-Ausfuehrung noch nicht bestaetigt.`,
    }
  } catch {
    checks.codexCli = { ok: false, detail: 'codex CLI not found in PATH' }
  }

  // Check 3: Anthropic/OpenAI API keys remain optional fallbacks
  const keys = readStoredApiKeys()
  const hasAnthropicKey = Boolean(keys.ANTHROPIC_API_KEY?.trim())
  const hasOpenAiKey = Boolean(keys.OPENAI_API_KEY?.trim())
  checks.anthropicKey = { ok: hasAnthropicKey, detail: hasAnthropicKey ? 'configured' : 'ANTHROPIC_API_KEY not set (optional when CLI is ready)' }
  checks.openAiKey = { ok: hasOpenAiKey, detail: hasOpenAiKey ? 'configured' : 'OPENAI_API_KEY not set (optional when CLI is ready)' }

  // Check 4: GitHub CLI available
  try {
    execSync('gh --version', { stdio: 'ignore', timeout: 3000 })
    checks.githubCli = { ok: true, detail: 'gh CLI available' }
  } catch {
    checks.githubCli = { ok: false, detail: 'gh CLI not found — PR creation will fail' }
  }

  // Check 5: Git available
  try {
    execSync('git --version', { stdio: 'ignore', timeout: 3000 })
    checks.git = { ok: true, detail: 'git available' }
  } catch {
    checks.git = { ok: false, detail: 'git not found' }
  }

  // Check 5: Intake endpoint reachable
  checks.intakeWebhook = {
    ok: true,
    detail: 'POST /api/intake ready',
  }

  const hasExecutableAgent = runnerReadiness.ready
  const requiredChecksOk = checks.githubCli.ok && checks.git.ok && checks.intakeWebhook.ok && hasExecutableAgent
  const mode = runnerReadiness.activeMode === 'claude-cli'
    ? 'claude-cli (headless verified)'
    : runnerReadiness.activeMode === 'codex-cli'
      ? 'codex-cli (headless verified)'
      : runnerReadiness.activeMode === 'claude-api'
        ? 'claude-api (API fallback)'
        : runnerReadiness.activeMode === 'openai-api'
          ? 'openai-api (API fallback)'
          : 'simulation (no executable agent configured)'

  return NextResponse.json({
    ready: requiredChecksOk,
    executionMode: mode,
    zeroKeyReady: runnerReadiness.zeroKeyReady,
    apiKeysOptional: true,
    checks,
    n8nPayload: {
      description: 'Example n8n payload for /api/intake',
      url: 'POST /api/intake',
      headers: { 'Content-Type': 'application/json', 'x-forgepilot-signature': '<hmac-or-omit-if-no-secret>' },
      body: {
        title: 'Feature: Add export to CSV',
        rawIdea: 'Users need to export their delegation history as CSV for reporting',
        problemStatement: 'No way to export data from the app',
        targetAudience: 'Power users and team leads',
        desiredOutcome: 'A working CSV export with all relevant delegation fields',
        constraints: ['Keep it simple', 'No new dependencies'],
        scope: 'standard',
        researchMode: 'standard',
        privacyMode: 'local',
        autoDelegate: true,
        autoApprove: true,
        autoExecute: false, // set to true to immediately start Claude
      },
    },
  })
}
