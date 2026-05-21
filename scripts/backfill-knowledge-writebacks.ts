#!/usr/bin/env tsx

/**
 * Backfill Knowledge Writebacks for completed delegations.
 *
 * Usage:
 *   npm run knowledge:backfill
 *   npm run knowledge:backfill -- --dry-run
 *   npm run knowledge:backfill -- --limit=5
 */

import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { extractKnowledge } from '@/lib/knowledge/extraction'
import { writebackExecutionInsights } from '@/lib/knowledge/writeback'

interface Args {
  dryRun: boolean
  limit?: number
}

function parseArgs(argv: string[]): Args {
  const dryRun = argv.includes('--dry-run')
  const limitArg = argv.find(arg => arg.startsWith('--limit='))
  const parsedLimit = limitArg ? Number(limitArg.split('=')[1]) : undefined
  const limit = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0
    ? Math.floor(parsedLimit)
    : undefined

  return { dryRun, limit }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const knowledgeRepo = createKnowledgeCardRepository(SINGLE_TENANT_USER_ID)

  const completed = (await delegationRepo.listByStatus(['completed']))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const candidates = typeof args.limit === 'number' ? completed.slice(0, args.limit) : completed

  let alreadyPresent = 0
  let extracted = 0
  let insightCards = 0
  let skippedNoCritic = 0
  let failed = 0

  for (const delegation of candidates) {
    const existing = await knowledgeRepo.listByDelegation(delegation.id)
    if (existing.length > 0) {
      alreadyPresent++
      continue
    }

    if (args.dryRun) {
      if (!delegation.criticScore) skippedNoCritic++
      continue
    }

    try {
      const extraction = await extractKnowledge(delegation)
      if (extraction?.saved) extracted++

      if (delegation.criticScore) {
        const result = await writebackExecutionInsights(delegation)
        if (!result.skipped) insightCards += result.saved
      } else {
        skippedNoCritic++
      }
    } catch {
      failed++
    }
  }

  const summary = {
    dryRun: args.dryRun,
    scannedCompletedDelegations: candidates.length,
    alreadyPresent,
    extracted,
    insightCards,
    skippedNoCritic,
    failed,
  }

  console.log(JSON.stringify(summary, null, 2))

  if (failed > 0) {
    process.exitCode = 1
  }

  process.exit(process.exitCode ?? 0)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
