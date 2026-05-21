#!/usr/bin/env npx tsx
/**
 * Backfill Script — JSON stores → PostgreSQL
 *
 * Reads existing config/*.json delegation data and inserts into Postgres.
 * Safe to run multiple times: uses INSERT ... ON CONFLICT DO UPDATE
 * (upsert by ID) so re-runs don't create duplicates.
 *
 * Prerequisites:
 *   1. DATABASE_URL is set
 *   2. Schema is migrated: npx drizzle-kit push
 *   3. A user row exists (created by this script if ADMIN_EMAIL is set)
 *
 * Usage:
 *   npx tsx scripts/backfill-json-to-postgres.ts
 *   ADMIN_EMAIL=you@example.com npx tsx scripts/backfill-json-to-postgres.ts
 *
 * The script reports counts and any rows that failed to insert.
 * On completion it prints the userId to use as FORGEPILOT_SINGLE_TENANT_USER_ID.
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// -- resolve tsconfig paths manually for tsx --
process.env.DATABASE_URL ??= 'postgresql://forgepilot:forgepilot@localhost:5432/forgepilot'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import {
  users,
  delegations as delegationsTable,
} from '../src/db/schema'
import type { NewDelegation } from '../src/db/schema'
import type { Delegation } from '../src/lib/models/delegation'

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(process.cwd(), 'config')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@forgepilot.local'
const ADMIN_NAME  = process.env.ADMIN_NAME  ?? 'ForgePilot Admin'
const DRY_RUN     = process.env.DRY_RUN === 'true'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson<T>(filename: string): T[] {
  const filepath = path.join(CONFIG_DIR, filename)
  try {
    const raw = fs.readFileSync(filepath, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`)
}

function warn(msg: string) {
  process.stderr.write(`⚠️  ${msg}\n`)
}

function die(msg: string): never {
  process.stderr.write(`❌ ${msg}\n`)
  process.exit(1)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) die('DATABASE_URL is not set')

  log('')
  log('🚀 ForgePilot — JSON → PostgreSQL Backfill')
  log(`   Mode:        ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)
  log(`   Database:    ${url.replace(/:([^@]+)@/, ':***@')}`)   // redact password
  log(`   Admin email: ${ADMIN_EMAIL}`)
  log('')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { schema: { users, delegations: delegationsTable } })

  // ─── 1. Verify connection ──────────────────────────────────────────────────
  try {
    await db.execute(sql`SELECT 1`)
    log('✅ Database connection OK')
  } catch (err) {
    die(`Cannot connect to database: ${err instanceof Error ? err.message : String(err)}\n   Run: npx drizzle-kit push`)
  }

  // ─── 2. Ensure admin user exists ──────────────────────────────────────────
  let userId: string

  if (!DRY_RUN) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .limit(1)

    if (existing[0]) {
      userId = existing[0].id
      log(`✅ Using existing user: ${userId}`)
    } else {
      userId = randomUUID()
      await db.insert(users).values({
        id:       userId,
        email:    ADMIN_EMAIL,
        name:     ADMIN_NAME,
        tenantId: 'default',
        role:     'owner',
      })
      log(`✅ Created admin user: ${userId}`)
    }
  } else {
    userId = 'dry-run-user-id'
  }

  // ─── 3. Backfill delegations ───────────────────────────────────────────────
  const rawDelegations = readJson<Delegation>('delegations.json')
  log(`\n📋 Delegations: ${rawDelegations.length} found in JSON store`)

  let delegationOk = 0
  let delegationSkipped = 0
  const delegationErrors: string[] = []

  for (const d of rawDelegations) {
    if (!d.id || !d.title || !d.contract) {
      warn(`Skipping delegation with missing fields: ${JSON.stringify(d).slice(0, 80)}`)
      delegationSkipped++
      continue
    }

    const row: NewDelegation = {
      id:              d.id,
      userId,
      projectId:       null,
      title:           d.title,
      status:          d.status ?? 'pending',
      riskClass:       (d.contract.riskClass as unknown as string ?? 'B') as 'A' | 'B' | 'C',
      executionRoute:  d.executionRoute ?? 'manual',
      contract:        d.contract as unknown as Record<string, unknown>,
      summaryReport:   d.summaryReport as unknown as Record<string, unknown> | undefined ?? null,
      logs:            (d.logs ?? []) as unknown as Array<Record<string, unknown>>,
      costEstimateUsd: d.costEstimateUsd ?? 0,
      actualCostUsd:   d.actualCostUsd ?? null,
      promptTokens:    d.summaryReport?.costSavings?.tokensUsed?.promptTokens ?? null,
      completionTokens: d.summaryReport?.costSavings?.tokensUsed?.completionTokens ?? null,
      traceId:         d.traceId ?? null,
      agentRunId:      d.agentRunId ?? null,
      prUrl:           (d.summaryReport?.prUrl as string | undefined) ?? null,
      errorMessage:    d.errorMessage ?? null,
      failureFeedback: d.failureFeedback ?? null,
      note:            d.note?.text ?? null,
      autoOrchestrate: d.autoOrchestrate ?? false,
      priority:        d.priority ?? null,
      briefId:         d.briefId ?? null,
      createdAt:       new Date(d.createdAt),
      updatedAt:       new Date(d.updatedAt ?? d.createdAt),
    }

    if (DRY_RUN) {
      log(`   [dry] would upsert delegation: ${d.id} — ${d.title.slice(0, 50)}`)
      delegationOk++
      continue
    }

    try {
      await db
        .insert(delegationsTable)
        .values(row)
        .onConflictDoUpdate({
          target: delegationsTable.id,
          set: {
            title:           row.title,
            status:          row.status,
            riskClass:       row.riskClass,
            contract:        row.contract,
            summaryReport:   row.summaryReport,
            logs:            row.logs,
            costEstimateUsd: row.costEstimateUsd,
            actualCostUsd:   row.actualCostUsd,
            updatedAt:       row.updatedAt,
          },
        })
      delegationOk++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      delegationErrors.push(`  ${d.id}: ${msg}`)
      warn(`Failed to upsert delegation ${d.id}: ${msg}`)
    }
  }

  // ─── 4. Summary ───────────────────────────────────────────────────────────
  log('')
  log('─────────────────────────────────────────────')
  log('📊 Backfill Summary')
  log(`   Delegations: ${delegationOk} OK, ${delegationSkipped} skipped, ${delegationErrors.length} errors`)

  if (delegationErrors.length > 0) {
    log('\n   Errors:')
    delegationErrors.forEach(e => log(e))
  }

  log('')
  if (!DRY_RUN) {
    log('✅ Backfill complete!')
    log('')
    log('Next steps:')
    log(`  1. Add to .env.local:`)
    log(`       FORGEPILOT_SINGLE_TENANT_USER_ID=${userId}`)
    log(`       POSTGRES_MODE=dual`)
    log('  2. Restart the app and verify reads still work')
    log('  3. After 24h with no issues: POSTGRES_MODE=read')
    log('  4. After validation: POSTGRES_MODE=postgres')
  } else {
    log('✅ Dry run complete — no data was written')
    log('   Remove DRY_RUN=true to execute the backfill')
  }

  await client.end()
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
