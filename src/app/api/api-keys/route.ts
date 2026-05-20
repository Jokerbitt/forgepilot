export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const API_KEYS_FILE = path.join(process.cwd(), 'config', 'api-keys.json')

export interface ApiKeysConfig {
  GITHUB_TOKEN?: string
  LINEAR_API_KEY?: string
  LINEAR_TEAM_ID?: string
  ANTHROPIC_API_KEY?: string
  OLLAMA_BASE_URL?: string
}

type ApiKeySource = 'stored' | 'env' | 'missing'

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
  const tmp = `${API_KEYS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), 'utf-8')
  fs.renameSync(tmp, API_KEYS_FILE)
}

function maskKey(value: string): string {
  if (!value || value.length < 8) return '****'
  return '*'.repeat(Math.min(value.length - 4, 20)) + value.slice(-4)
}

function withEnvFallback(keys: ApiKeysConfig): ApiKeysConfig {
  return {
    GITHUB_TOKEN: keys.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
    LINEAR_API_KEY: keys.LINEAR_API_KEY ?? process.env.LINEAR_API_KEY,
    LINEAR_TEAM_ID: keys.LINEAR_TEAM_ID ?? process.env.LINEAR_TEAM_ID,
    ANTHROPIC_API_KEY: keys.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    OLLAMA_BASE_URL: keys.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL,
  }
}

function setFlags(keys: ApiKeysConfig): Record<keyof ApiKeysConfig, boolean> {
  return {
    GITHUB_TOKEN: !!keys.GITHUB_TOKEN,
    LINEAR_API_KEY: !!keys.LINEAR_API_KEY,
    LINEAR_TEAM_ID: !!keys.LINEAR_TEAM_ID,
    ANTHROPIC_API_KEY: !!keys.ANTHROPIC_API_KEY,
    OLLAMA_BASE_URL: !!keys.OLLAMA_BASE_URL,
  }
}

function keySources(stored: ApiKeysConfig): Record<keyof ApiKeysConfig, ApiKeySource> {
  return {
    GITHUB_TOKEN: stored.GITHUB_TOKEN ? 'stored' : process.env.GITHUB_TOKEN ? 'env' : 'missing',
    LINEAR_API_KEY: stored.LINEAR_API_KEY ? 'stored' : process.env.LINEAR_API_KEY ? 'env' : 'missing',
    LINEAR_TEAM_ID: stored.LINEAR_TEAM_ID ? 'stored' : process.env.LINEAR_TEAM_ID ? 'env' : 'missing',
    ANTHROPIC_API_KEY: stored.ANTHROPIC_API_KEY ? 'stored' : process.env.ANTHROPIC_API_KEY ? 'env' : 'missing',
    OLLAMA_BASE_URL: stored.OLLAMA_BASE_URL ? 'stored' : process.env.OLLAMA_BASE_URL ? 'env' : 'missing',
  }
}

export async function GET() {
  const stored = readApiKeys()
  const merged = withEnvFallback(stored)

  return NextResponse.json({
    GITHUB_TOKEN: merged.GITHUB_TOKEN ? maskKey(merged.GITHUB_TOKEN) : '',
    LINEAR_API_KEY: merged.LINEAR_API_KEY ? maskKey(merged.LINEAR_API_KEY) : '',
    LINEAR_TEAM_ID: merged.LINEAR_TEAM_ID ?? '',
    ANTHROPIC_API_KEY: merged.ANTHROPIC_API_KEY ? maskKey(merged.ANTHROPIC_API_KEY) : '',
    OLLAMA_BASE_URL: merged.OLLAMA_BASE_URL ?? '',
    _set: setFlags(merged),
    _source: keySources(stored),
  })
}

export async function POST(request: Request) {
  const updates = await request.json() as Partial<ApiKeysConfig>
  const current = readApiKeys()

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
    _set: setFlags(withEnvFallback(merged)),
  })
}
