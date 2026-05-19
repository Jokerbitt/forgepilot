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
import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/config/paths'

// Keys the user is allowed to save through this endpoint
const ALLOWED_KEYS = new Set([
  'GROQ_API_KEY',
  'TOGETHER_API_KEY',
  'MISTRAL_API_KEY',
  'GOOGLE_API_KEY',
])

interface EnvBody {
  key: string
  value: string
}

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
  let body: EnvBody

  try {
    body = await request.json() as EnvBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { key, value } = body

  if (typeof key !== 'string' || typeof value !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Both key and value must be strings' },
      { status: 400 },
    )
  }

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
