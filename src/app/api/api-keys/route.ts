export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { recordKeySet, removeKeyMeta } from '@/lib/api-keys/rotation-tracker'
import { type ApiKeysConfig, isValidCriticMode, isValidLlmMode } from '@/lib/api-keys/types'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ApiKeysUpdateSchema } from '@/lib/validation/schemas'

const API_KEYS_FILE = path.join(process.cwd(), 'config', 'api-keys.json')

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
  const rawCriticMode = keys.FORGEPILOT_CRITIC_MODE ?? process.env.FORGEPILOT_CRITIC_MODE
  const criticMode = isValidCriticMode(rawCriticMode) ? rawCriticMode : 'auto'
  return {
    GITHUB_TOKEN: keys.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
    LINEAR_API_KEY: keys.LINEAR_API_KEY ?? process.env.LINEAR_API_KEY,
    LINEAR_TEAM_ID: keys.LINEAR_TEAM_ID ?? process.env.LINEAR_TEAM_ID,
    ANTHROPIC_API_KEY: keys.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: keys.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
    XAI_API_KEY: keys.XAI_API_KEY ?? process.env.XAI_API_KEY,
    GOOGLE_API_KEY: keys.GOOGLE_API_KEY ?? process.env.GOOGLE_API_KEY,
    GROQ_API_KEY: keys.GROQ_API_KEY ?? process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: keys.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY,
    MISTRAL_API_KEY: keys.MISTRAL_API_KEY ?? process.env.MISTRAL_API_KEY,
    DEEPSEEK_API_KEY: keys.DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY,
    OLLAMA_BASE_URL: keys.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL,
    LM_STUDIO_BASE_URL: keys.LM_STUDIO_BASE_URL ?? process.env.LM_STUDIO_BASE_URL,
    LLM_MODE: llmMode,
    FORGEPILOT_CRITIC_MODE: criticMode,
    FORGEPILOT_CRITIC_PROVIDERS: keys.FORGEPILOT_CRITIC_PROVIDERS ?? process.env.FORGEPILOT_CRITIC_PROVIDERS,
  }
}

function setFlags(keys: ApiKeysConfig): Record<keyof ApiKeysConfig, boolean> {
  return {
    GITHUB_TOKEN: !!keys.GITHUB_TOKEN,
    LINEAR_API_KEY: !!keys.LINEAR_API_KEY,
    LINEAR_TEAM_ID: !!keys.LINEAR_TEAM_ID,
    ANTHROPIC_API_KEY: !!keys.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!keys.OPENAI_API_KEY,
    XAI_API_KEY: !!keys.XAI_API_KEY,
    GOOGLE_API_KEY: !!keys.GOOGLE_API_KEY,
    GROQ_API_KEY: !!keys.GROQ_API_KEY,
    OPENROUTER_API_KEY: !!keys.OPENROUTER_API_KEY,
    MISTRAL_API_KEY: !!keys.MISTRAL_API_KEY,
    DEEPSEEK_API_KEY: !!keys.DEEPSEEK_API_KEY,
    OLLAMA_BASE_URL: !!keys.OLLAMA_BASE_URL,
    LM_STUDIO_BASE_URL: !!keys.LM_STUDIO_BASE_URL,
    LLM_MODE: !!keys.LLM_MODE,
    FORGEPILOT_CRITIC_MODE: !!keys.FORGEPILOT_CRITIC_MODE,
    FORGEPILOT_CRITIC_PROVIDERS: !!keys.FORGEPILOT_CRITIC_PROVIDERS,
  }
}

function keySources(stored: ApiKeysConfig): Record<keyof ApiKeysConfig, ApiKeySource> {
  return {
    GITHUB_TOKEN: stored.GITHUB_TOKEN ? 'stored' : process.env.GITHUB_TOKEN ? 'env' : 'missing',
    LINEAR_API_KEY: stored.LINEAR_API_KEY ? 'stored' : process.env.LINEAR_API_KEY ? 'env' : 'missing',
    LINEAR_TEAM_ID: stored.LINEAR_TEAM_ID ? 'stored' : process.env.LINEAR_TEAM_ID ? 'env' : 'missing',
    ANTHROPIC_API_KEY: stored.ANTHROPIC_API_KEY ? 'stored' : process.env.ANTHROPIC_API_KEY ? 'env' : 'missing',
    OPENAI_API_KEY: stored.OPENAI_API_KEY ? 'stored' : process.env.OPENAI_API_KEY ? 'env' : 'missing',
    XAI_API_KEY: stored.XAI_API_KEY ? 'stored' : process.env.XAI_API_KEY ? 'env' : 'missing',
    GOOGLE_API_KEY: stored.GOOGLE_API_KEY ? 'stored' : process.env.GOOGLE_API_KEY ? 'env' : 'missing',
    GROQ_API_KEY: stored.GROQ_API_KEY ? 'stored' : process.env.GROQ_API_KEY ? 'env' : 'missing',
    OPENROUTER_API_KEY: stored.OPENROUTER_API_KEY ? 'stored' : process.env.OPENROUTER_API_KEY ? 'env' : 'missing',
    MISTRAL_API_KEY: stored.MISTRAL_API_KEY ? 'stored' : process.env.MISTRAL_API_KEY ? 'env' : 'missing',
    DEEPSEEK_API_KEY: stored.DEEPSEEK_API_KEY ? 'stored' : process.env.DEEPSEEK_API_KEY ? 'env' : 'missing',
    OLLAMA_BASE_URL: stored.OLLAMA_BASE_URL ? 'stored' : process.env.OLLAMA_BASE_URL ? 'env' : 'missing',
    LM_STUDIO_BASE_URL: stored.LM_STUDIO_BASE_URL ? 'stored' : process.env.LM_STUDIO_BASE_URL ? 'env' : 'missing',
    LLM_MODE: stored.LLM_MODE ? 'stored' : process.env.LLM_MODE ? 'env' : 'missing',
    FORGEPILOT_CRITIC_MODE: stored.FORGEPILOT_CRITIC_MODE ? 'stored' : process.env.FORGEPILOT_CRITIC_MODE ? 'env' : 'missing',
    FORGEPILOT_CRITIC_PROVIDERS: stored.FORGEPILOT_CRITIC_PROVIDERS ? 'stored' : process.env.FORGEPILOT_CRITIC_PROVIDERS ? 'env' : 'missing',
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
    OPENAI_API_KEY: merged.OPENAI_API_KEY ? maskKey(merged.OPENAI_API_KEY) : '',
    XAI_API_KEY: merged.XAI_API_KEY ? maskKey(merged.XAI_API_KEY) : '',
    GOOGLE_API_KEY: merged.GOOGLE_API_KEY ? maskKey(merged.GOOGLE_API_KEY) : '',
    GROQ_API_KEY: merged.GROQ_API_KEY ? maskKey(merged.GROQ_API_KEY) : '',
    OPENROUTER_API_KEY: merged.OPENROUTER_API_KEY ? maskKey(merged.OPENROUTER_API_KEY) : '',
    MISTRAL_API_KEY: merged.MISTRAL_API_KEY ? maskKey(merged.MISTRAL_API_KEY) : '',
    DEEPSEEK_API_KEY: merged.DEEPSEEK_API_KEY ? maskKey(merged.DEEPSEEK_API_KEY) : '',
    OLLAMA_BASE_URL: merged.OLLAMA_BASE_URL ?? '',
    LM_STUDIO_BASE_URL: merged.LM_STUDIO_BASE_URL ?? '',
    LLM_MODE: merged.LLM_MODE ?? 'auto',
    FORGEPILOT_CRITIC_MODE: merged.FORGEPILOT_CRITIC_MODE ?? 'auto',
    FORGEPILOT_CRITIC_PROVIDERS: merged.FORGEPILOT_CRITIC_PROVIDERS ?? '',
    _set: setFlags(merged),
    _source: keySources(stored),
  })
}

export async function POST(request: Request) {
  const result = await parseBody(request as Parameters<typeof parseBody>[0], ApiKeysUpdateSchema)
  if (isValidationError(result)) return result
  const updates = result as Partial<ApiKeysConfig>
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
      } else if (key === 'FORGEPILOT_CRITIC_MODE') {
        if (isValidCriticMode(v)) {
          merged.FORGEPILOT_CRITIC_MODE = v
          recordKeySet(key, v)
        }
      } else {
        // All other keys are string fields
        const stringKey = key as Exclude<keyof ApiKeysConfig, 'LLM_MODE' | 'FORGEPILOT_CRITIC_MODE'>
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
