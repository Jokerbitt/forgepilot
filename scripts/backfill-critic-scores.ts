#!/usr/bin/env npx tsx
/**
 * Backfill missing critic scores for completed delegations.
 *
 * Uses the configured critic provider chain from grok-critic.ts:
 * xAI/Grok first, then local Ollama (qwen2.5-coder:14b by default).
 *
 * Usage:
 *   npm run critic:backfill
 *   npm run critic:backfill -- --limit=3
 *   npm run critic:backfill -- --dry-run
 */

import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '../src/lib/repositories/delegationRepository'
import { persistGrokCriticForDelegation } from '../src/lib/eval/auto-grok-critic'
import fs from 'fs'
import path from 'path'

interface Options {
  dryRun: boolean
  limit?: number
}

function parseOptions(argv: string[]): Options {
  const limitArg = argv.find(arg => arg.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined

  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error('--limit must be a positive integer')
  }

  return {
    dryRun: argv.includes('--dry-run'),
    limit,
  }
}

function loadLocalEnv(): void {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) continue

    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)
    for (const line of lines) {
      if (!line || line.trim().startsWith('#')) continue
      const separator = line.indexOf('=')
      if (separator === -1) continue

      const key = line.slice(0, separator).trim()
      const rawValue = line.slice(separator + 1).trim()
      if (!key || process.env[key] !== undefined) continue
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  }
}

async function main(): Promise<void> {
  loadLocalEnv()
  const options = parseOptions(process.argv.slice(2))
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const completed = await repo.listByStatus(['completed'])
  const missing = completed
    .filter(delegation => !delegation.criticScore)
    .slice(0, options.limit ?? completed.length)

  console.log(JSON.stringify({
    dryRun: options.dryRun,
    completedDelegations: completed.length,
    missingCriticScores: missing.length,
    ids: missing.map(delegation => delegation.id),
  }, null, 2))

  if (options.dryRun || missing.length === 0) return

  let saved = 0
  let failed = 0

  for (const delegation of missing) {
    try {
      const score = await persistGrokCriticForDelegation(delegation)
      if (score) {
        saved += 1
        console.log(`saved critic score for ${delegation.id}: ${score.verdict}`)
      } else {
        failed += 1
        console.warn(`critic unavailable for ${delegation.id}`)
      }
    } catch (error) {
      failed += 1
      console.warn(`critic backfill failed for ${delegation.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(JSON.stringify({ saved, failed }, null, 2))

  if (failed > 0) process.exit(1)
}

main().then(() => {
  process.exit(0)
}).catch((error: unknown) => {
  console.error('Fatal critic backfill error:', error)
  process.exit(1)
})
