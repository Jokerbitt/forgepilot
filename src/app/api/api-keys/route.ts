export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { recordKeySet, removeKeyMeta } from '@/lib/api-keys/rotation-tracker'

const API_KEYS_FILE = path.join(process.cwd(), 'config', 'api-keys.json')

export type LlmMode = 'auto' | 'anthropic' | 'groq' | 'ollama' | 'lmstudio'

const VALID_LLM_MODES: LlmMode[] = ['auto', 'anthropic', 'groq', 'ollama', 'lmstudio']

export function isValidLlmMode(value: unknown): value is LlmMode {
  return typeof value === 'string' && (VALID_LLM_MODES as string[]).includes(value)
}

export interface ApiKeysConfig {
  GITHUB_TOKEN?: string
  LINEAR_API_KEY?: string
  LINEAR_TEAM_ID?: string
  ANTHROPIC_API_KEY?: string
  GROQ_API_KEY?: string
  OLLAMA_BASE_URL?: string
  LM_STUDIO_BASE_URL?: string
  LLM_MODE?: LlmMode
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
  const rawMode = keys.LLM_MODE ?? process.env.LLM_MODE
  const llmMode = isValidLlmMode(rawMode) ? rawMode : 'auto'
  return {
    GITHUB_TOKEN: keys.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
    LINEAR_API_KEY: keys.LINEAR_API_KEY ?? process.env.LINEAR_API_KEY,
    LINEAR_TEAM_ID: keys.LINEAR_TEAM_ID ?? process.env.LINEAR_TEAM_ID,
    ANTHROPIC_API_KEY: keys.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    GROQ_API_KEY: keys.GROQ_API_KEY ?? process.env.GROQ_API_KEY,
    OLLAMA_BASE_URL: keys.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL,
    LM_STUDIO_BASE_URL: keys.LM_STUDIO_BASE_URL ?? process.env.LM_STUDIO_BASE_URL,
    LLM_MODE: llmMode,
  }
}

function setFlags(keys: ApiKeysConfig): Record<keyof ApiKeysConfig, boolean> {
  return {
    GITHUB_TOKEN: !!keys.GITHUB_TOKEN,
    LINEAR_API_KEY: !!keys.LINEAR_API_KEY,
    LINEAR_TEAM_ID: !!keys.LINEAR_TEAM_ID,
    ANTHROPIC_API_KEY: !!keys.ANTHROPIC_API_KEY,
    GROQ_API_KEY: !!keys.GROQ_API_KEY,
    OLLAMA_BASE_URL: !!keys.OLLAMA_BASE_URL,
    LM_STUDIO_BASE_URL: !!keys.LM_STUDIO_BASE_URL,
    LLM_MODE: !!keys.LLM_MODE,
  }
}

function keySources(stored: ApiKeysConfig): Record<keyof ApiKeysConfig, ApiKeySource> {
  return {
    GITHUB_TOKEN: stored.GITHUB_TOKEN ? 'stored' : process.env.GITHUB_TOKEN ? 'env' : 'missing',
    LINEAR_API_KEY: stored.LINEAR_API_KEY ? 'stored' : process.env.LINEAR_API_KEY ? 'env' : 'missing',
    LINEAR_TEAM_ID: stored.LINEAR_TEAM_ID ? 'stored' : process.env.LINEAR_TEAM_ID ? 'env' : 'missing',
    ANTHROPIC_API_KEY: stored.ANTHROPIC_API_KEY ? 'stored' : process.env.ANTHROPIC_API_KEY ? 'env' : 'missing',
    GROQ_API_KEY: stored.GROQ_API_KEY ? 'stored' : process.env.GROQ_API_KEY ? 'env' : 'missing',
    OLLAMA_BASE_URL: stored.OLLAMA_BASE_URL ? 'stored' : process.env.OLLAMA_BASE_URL ? 'env' : 'missing',
    LM_STUDIO_BASE_URL: stored.LM_STUDIO_BASE_URL ? 'stored' : process.env.LM_STUDIO_BASE_URL ? 'env' : 'missing',
    LLM_MODE: stored.LLM_MODE ? 'stored' : process.env.LLM_MODE ? 'env' : 'missing',
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
    GROQ_API_KEY: merged.GROQ_API_KEY ? maskKey(merged.GROQ_API_KEY) : '',
    OLLAMA_BASE_URL: merged.OLLAMA_BASE_URL ?? '',
    LM_STUDIO_BASE_URL: merged.LM_STUDIO_BASE_URL ?? '',
    LLM_MODE: merged.LLM_MODE ?? 'auto',
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
        removeKeyMeta(key)
      } else if (key === 'LLM_MODE') {
        if (isValidLlmMode(v)) {
          merged.LLM_MODE = v
          recordKeySet(key, v)
        }
      } else {
        // All other keys are string fields
        const stringKey = key as Exclude<keyof ApiKeysConfig, 'LLM_MODE'>
        merged[stringKey] = v
        recordKeySet(key, v)
      }
    }
  }

  writeApiKeys(merged)

  return NextResponse.json({
    ok: true,
    _set: setFlags(withEnvFallback(merged)),
  })
}
