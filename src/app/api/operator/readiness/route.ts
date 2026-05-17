import { NextResponse } from 'next/server'
import { readConnectorConfigs, readStoredApiKeys } from '@/lib/connectors/config'
import { getAllConnectorHealth } from '@/lib/connectors/registry'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import { readProjectBriefs } from '@/lib/project-briefs'
import { buildOperatorReadiness, readWorkflowReadiness } from '@/lib/operator/readiness'
import type { Delegation } from '@/lib/models/delegation'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

export async function GET() {
  const config = getNBAConfig()
  const storedKeys = readStoredApiKeys()
  const apiKeysSet = {
    GITHUB_TOKEN: Boolean(storedKeys.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN),
    LINEAR_API_KEY: Boolean(storedKeys.LINEAR_API_KEY ?? process.env.LINEAR_API_KEY),
    LINEAR_TEAM_ID: Boolean(storedKeys.LINEAR_TEAM_ID ?? process.env.LINEAR_TEAM_ID),
    ANTHROPIC_API_KEY: Boolean(storedKeys.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY),
    OLLAMA_BASE_URL: Boolean(storedKeys.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL),
  }

  const [connectors, ollamaReachable] = await Promise.all([
    getAllConnectorHealth(readConnectorConfigs()),
    checkOllama(config.aiProvider === 'ollama'
      ? (process.env.OLLAMA_BASE_URL ?? storedKeys.OLLAMA_BASE_URL)
      : undefined),
  ])

  return NextResponse.json(buildOperatorReadiness({
    connectors,
    config,
    apiKeysSet,
    workflows: readWorkflowReadiness(),
    briefs: readProjectBriefs(),
    delegations: readDelegations(),
    ollamaReachable,
  }))
}

function readDelegations(): Delegation[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as unknown
    return Array.isArray(parsed) ? parsed as Delegation[] : []
  } catch {
    return []
  }
}

async function checkOllama(baseUrl: string | undefined): Promise<boolean | null> {
  if (!baseUrl) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const normalized = baseUrl.replace(/\/+$/, '')
    const response = await fetch(`${normalized}/api/tags`, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
