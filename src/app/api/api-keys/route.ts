import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const API_KEYS_FILE = path.join(process.cwd(), 'config', 'api-keys.json')

export interface ApiKeysConfig {
  GITHUB_TOKEN?: string
  LINEAR_API_KEY?: string
  ANTHROPIC_API_KEY?: string
}

function readApiKeys(): ApiKeysConfig {
  try {
    return JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf-8')) as ApiKeysConfig
  } catch {
    return {}
  }
}

function writeApiKeys(keys: ApiKeysConfig) {
  const dir = path.dirname(API_KEYS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = API_KEYS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), 'utf-8')
  fs.renameSync(tmp, API_KEYS_FILE)
}

/** Mask a key so only last 4 chars are visible: ghp_...a1b2 */
function maskKey(value: string): string {
  if (!value || value.length < 8) return '••••'
  return '•'.repeat(Math.min(value.length - 4, 20)) + value.slice(-4)
}

export async function GET() {
  const keys = readApiKeys()
  // Return masked values so the UI can show whether a key is set
  return NextResponse.json({
    GITHUB_TOKEN: keys.GITHUB_TOKEN ? maskKey(keys.GITHUB_TOKEN) : '',
    LINEAR_API_KEY: keys.LINEAR_API_KEY ? maskKey(keys.LINEAR_API_KEY) : '',
    ANTHROPIC_API_KEY: keys.ANTHROPIC_API_KEY ? maskKey(keys.ANTHROPIC_API_KEY) : '',
    // Flags for UI to know if key is actually set (unmasked)
    _set: {
      GITHUB_TOKEN: !!keys.GITHUB_TOKEN,
      LINEAR_API_KEY: !!keys.LINEAR_API_KEY,
      ANTHROPIC_API_KEY: !!keys.ANTHROPIC_API_KEY,
    },
  })
}

export async function POST(request: Request) {
  const updates = await request.json() as Partial<ApiKeysConfig>
  const current = readApiKeys()

  // Only update keys that are actually provided and non-empty
  // An empty string means "clear the key"
  const merged: ApiKeysConfig = { ...current }
  for (const [k, v] of Object.entries(updates)) {
    const key = k as keyof ApiKeysConfig
    if (typeof v === 'string') {
      if (v === '') {
        delete merged[key]
      } else {
        merged[key] = v
      }
    }
  }

  writeApiKeys(merged)

  return NextResponse.json({
    ok: true,
    _set: {
      GITHUB_TOKEN: !!merged.GITHUB_TOKEN,
      LINEAR_API_KEY: !!merged.LINEAR_API_KEY,
      ANTHROPIC_API_KEY: !!merged.ANTHROPIC_API_KEY,
    },
  })
}
