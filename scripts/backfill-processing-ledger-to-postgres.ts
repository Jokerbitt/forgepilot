#!/usr/bin/env npx tsx
/**
 * Backfill DSGVO processing ledger JSON records into Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npm run db:backfill-ledger
 *   DRY_RUN=true DATABASE_URL=postgresql://... npm run db:backfill-ledger
 */

import fs from 'fs'
import path from 'path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { processingLedger } from '../src/db/schema'
import type { ProcessingRecord } from '../src/lib/dsgvo/processing-ledger'

const DRY_RUN = process.env.DRY_RUN === 'true'
const DATABASE_URL = process.env.DATABASE_URL
const LEDGER_FILE = path.join(process.cwd(), 'config', 'processing-ledger.json')

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Aborting.')
  process.exit(1)
}

function readJsonLedger(): ProcessingRecord[] {
  if (!fs.existsSync(LEDGER_FILE)) return []
  const parsed = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf-8')) as unknown
  return Array.isArray(parsed) ? parsed as ProcessingRecord[] : []
}

function toDbRecord(record: ProcessingRecord): typeof processingLedger.$inferInsert {
  return {
    id: record.id,
    purpose: record.purpose,
    dataTypes: record.dataTypes ?? [],
    processor: record.processor,
    legalBasis: record.legalBasis ?? 'legitimate-interest',
    dataSubjectId: record.dataSubjectId,
    piiDetected: record.piiDetected ?? false,
    piiCategories: record.piiCategories ?? [],
    piiRedacted: record.piiRedacted ?? false,
    piiCount: record.piiCount ?? 0,
    dataResidency: record.dataResidency ?? 'unknown',
    providerId: record.providerId,
    modelId: record.modelId,
    inputTokens: record.inputTokens,
    retentionDays: record.retentionDays ?? 1825,
    processedAt: new Date(record.processedAt),
  }
}

async function main(): Promise<void> {
  const records = readJsonLedger()
  console.log(`Found ${records.length} processing ledger record(s) in ${LEDGER_FILE}`)

  if (records.length === 0) return

  if (DRY_RUN) {
    for (const record of records.slice(0, 25)) {
      console.log(`  ${record.id} ${record.processor}/${record.modelId ?? 'unknown'} ${record.processedAt}`)
    }
    if (records.length > 25) console.log(`  ... ${records.length - 25} more`)
    return
  }

  const client = postgres(DATABASE_URL!, { max: 1, prepare: false })
  const db = drizzle(client, { logger: false })
  let upserted = 0
  let failed = 0

  for (const record of records) {
    try {
      await db
        .insert(processingLedger)
        .values(toDbRecord(record))
        .onConflictDoUpdate({
          target: processingLedger.id,
          set: toDbRecord(record),
        })
      upserted++
    } catch (err) {
      failed++
      console.error(`Failed to upsert ledger record ${record.id}`, err)
    }
  }

  await client.end()
  console.log(`Upserted processing ledger records: ${upserted} | Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

