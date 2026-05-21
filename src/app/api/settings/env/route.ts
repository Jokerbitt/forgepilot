export const dynamic = 'force-dynamic'
/**
 * POST /api/settings/env
 *
 * Saves an API key to:
 *   1. process.env  (runtime, current process only)
 *   2. config/api-keys.json  (persisted across restarts, gitignored)
 *
 * Security: only keys on the explicit allowlist are accepted.
 * Sensitive keys (ANTHROPIC_API_KEY, LINEAR_API_KEY, GITHUB_TOKEN, etc.)
 * are never accepted here — they must be set via .env.local / system env.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/config/paths'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { EnvKeySchema } from '@/lib/validation/schemas'

// Keys the user is allowed to save through this endpoint.
// Sensitive infra keys (ANTHROPIC, LINEAR, GITHUB, DATABASE) are NOT here —
// those must be set via .env.local or system environment.
const ALLOWED_KEYS = new Set([
  // ─── AI Providers ──────────────────────────────────────────────────────
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'MISTRAL_API_KEY',
  'GOOGLE_API_KEY',
  'TOGETHER_API_KEY',
  'OPENROUTER_API_KEY',
  'DEEPSEEK_API_KEY',
  'XAI_API_KEY',
  'CEREBRAS_API_KEY',
  'SAMBANOVA_API_KEY',
  'PERPLEXITY_API_KEY',
  'FIREWORKS_API_KEY',
  'DEEPINFRA_API_KEY',
  'COHERE_API_KEY',
  'NVIDIA_API_KEY',
  // ─── Monitoring ────────────────────────────────────────────────────────
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_DSN',
])

function apiKeysPath(): string {
  return path.join(getDataDir(), 'api-keys.json')
}

function readApiKeys(): Record<string, string> {
  try {
    const raw = fs.readFileSync(apiKeysPath(), 'utf-8')
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function writeApiKeys(keys: Record<string, string>): void {
  const dir = path.dirname(apiKeysPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = apiKeysPath() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), 'utf-8')
  fs.renameSync(tmp, apiKeysPath())
}

export async function POST(request: Request) {
  const authError = await requireAuth()
  if (authError) return authError

  const bodyResult = await parseBody(request, EnvKeySchema)
  if (isValidationError(bodyResult)) return bodyResult

  const { key, value } = bodyResult

  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json(
      { ok: false, error: `Key "${key}" is not in the allowlist` },
      { status: 403 },
    )
  }

  // 1. Persist to config/api-keys.json
  const keys = readApiKeys()
  keys[key] = value
  writeApiKeys(keys)

  // 2. Set in current process environment (takes effect immediately for in-process code)
  process.env[key] = value

  return NextResponse.json({ ok: true })
}
