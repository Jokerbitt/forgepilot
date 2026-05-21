#!/usr/bin/env npx tsx
/**
 * Backfill script: reads config/delegations.json and upserts all delegations into Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/backfill-json-to-postgres.ts
 *   DRY_RUN=true DATABASE_URL=postgresql://... npx tsx scripts/backfill-json-to-postgres.ts
 *
 * Requires:
 *   - DATABASE_URL env var pointing to a running Postgres instance
 *   - Tables already created via: npx drizzle-kit push
 */

import fs from 'fs'
import path from 'path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { delegations } from '../src/db/schema'
import type { Delegation } from '../src/lib/models/delegation'

const DRY_RUN = process.env.DRY_RUN === 'true'
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Aborting.')
  process.exit(1)
}

// After the guard above, DATABASE_URL is guaranteed to be a string
const DB_URL: string = DATABASE_URL

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readJsonDelegations(): Delegation[] {
  if (!fs.existsSync(DELEGATIONS_FILE)) {
    console.warn(`⚠️  No delegations file found at ${DELEGATIONS_FILE}`)
    return []
  }
  const raw = fs.readFileSync(DELEGATIONS_FILE, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    console.warn('⚠️  delegations.json does not contain an array.')
    return []
  }
  return parsed as Delegation[]
}

async function main(): Promise<void> {
  const items = readJsonDelegations()
  console.log(`📂  Found ${items.length} delegation(s) in ${DELEGATIONS_FILE}`)

  if (items.length === 0) {
    console.log('Nothing to backfill. Done.')
    return
  }

  if (DRY_RUN) {
    console.log('🔍  DRY_RUN=true — no writes will be performed.')
    for (const d of items) {
      console.log(`  • ${d.id}  [${d.status}]  ${d.title}`)
    }
    return
  }

  const client = postgres(DB_URL, { max: 1, prepare: false })
  const db = drizzle(client, { logger: false })

  let upserted = 0
  let failed = 0

  for (const d of items) {
    try {
      await db
        .insert(delegations)
        .values({
          id: d.id,
          title: d.title,
          status: d.status,
          riskClass: (d.contract?.riskClass as 'A' | 'B' | 'C') ?? 'B',
          executionRoute: d.executionRoute,
          contract: d.contract as unknown as Record<string, unknown>,
          summaryReport:
            d.summaryReport != null
              ? (d.summaryReport as unknown as Record<string, unknown>)
              : null,
          logs:
            d.logs != null
              ? (d.logs as unknown as Array<Record<string, unknown>>)
              : [],
          costEstimateUsd: d.costEstimateUsd,
          actualCostUsd: d.actualCostUsd ?? null,
          traceId: d.traceId ?? null,
          agentRunId: d.agentRunId ?? null,
          errorMessage: d.errorMessage ?? null,
          failureFeedback: d.failureFeedback ?? null,
          note: d.note?.text ?? null,
          autoOrchestrate: d.autoOrchestrate ?? false,
          priority: d.priority ?? null,
          briefId: d.briefId ?? null,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        })
        .onConflictDoUpdate({
          target: delegations.id,
          set: {
            title: d.title,
            status: d.status,
            riskClass: (d.contract?.riskClass as 'A' | 'B' | 'C') ?? 'B',
            executionRoute: d.executionRoute,
            contract: d.contract as unknown as Record<string, unknown>,
            summaryReport:
              d.summaryReport != null
                ? (d.summaryReport as unknown as Record<string, unknown>)
                : null,
            logs:
              d.logs != null
                ? (d.logs as unknown as Array<Record<string, unknown>>)
                : [],
            costEstimateUsd: d.costEstimateUsd,
            actualCostUsd: d.actualCostUsd ?? null,
            traceId: d.traceId ?? null,
            agentRunId: d.agentRunId ?? null,
            errorMessage: d.errorMessage ?? null,
            failureFeedback: d.failureFeedback ?? null,
            note: d.note?.text ?? null,
            autoOrchestrate: d.autoOrchestrate ?? false,
            priority: d.priority ?? null,
            briefId: d.briefId ?? null,
            updatedAt: new Date(d.updatedAt),
          },
        })
      upserted++
      console.log(`  ✅  ${d.id}  ${d.title}`)
    } catch (err) {
      failed++
      console.error(`  ❌  ${d.id}  ${d.title}`, err)
    }
  }

  await client.end()

  console.log(`\n✅  Upserted: ${upserted}  |  Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
