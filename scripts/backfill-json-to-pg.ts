#!/usr/bin/env tsx
/**
 * backfill-json-to-pg.ts — One-shot JSON → Supabase migration
 *
 * Reads all local JSON config files and upserts their contents into the
 * corresponding Supabase tables. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=... npx tsx scripts/backfill-json-to-pg.ts
 *   npx tsx scripts/backfill-json-to-pg.ts --dry-run   # show what would be migrated
 *
 * Prerequisites:
 *   - Supabase project with schema from src/lib/supabase/schema.sql
 *   - SUPABASE_URL and SUPABASE_ANON_KEY env vars
 */

import fs from 'fs'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const CONFIG_DIR = process.env.FORGEPILOT_DATA_DIR ?? path.join(process.cwd(), 'config')

// ─── Supabase connection ──────────────────────────────────────────────────────

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set.')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson<T>(filename: string): T[] {
  const filePath = path.join(CONFIG_DIR, filename)
  if (!fs.existsSync(filePath)) return []
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    console.warn(`  WARN: Could not parse ${filename} — skipping`)
    return []
  }
}

function log(msg: string) {
  process.stdout.write(msg + '\n')
}

async function upsert(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string = 'id',
) {
  if (rows.length === 0) {
    log(`  ${table}: 0 rows — skipping`)
    return
  }
  if (DRY_RUN) {
    log(`  [DRY] ${table}: would upsert ${rows.length} row(s)`)
    return
  }
  const { error } = await client.from(table).upsert(rows, { onConflict })
  if (error) {
    console.error(`  ERROR upsert ${table}:`, error.message)
  } else {
    log(`  ${table}: upserted ${rows.length} row(s)`)
  }
}

// ─── Table mapping ────────────────────────────────────────────────────────────

interface MigrationTable {
  file: string
  table: string
  transform?: (row: Record<string, unknown>) => Record<string, unknown>
}

const TABLES: MigrationTable[] = [
  {
    file: 'delegations.json',
    table: 'delegations',
    transform: row => ({
      ...row,
      contract: row.contract ?? {},
      logs: row.logs ?? [],
      updated_at: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
      created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    }),
  },
  {
    file: 'orchestrated-runs.json',
    table: 'orchestrated_runs',
    transform: row => ({
      ...row,
      tasks: row.tasks ?? [],
      updated_at: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
      created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    }),
  },
  {
    file: 'notifications.json',
    table: 'notifications',
  },
  {
    file: 'local-items.json',
    table: 'work_items',
    transform: row => ({
      ...row,
      url: row.url ?? '',
      updated_at: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
      created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    }),
  },
  {
    file: 'project-briefs.json',
    table: 'project_briefs',
    transform: row => ({
      ...row,
      updated_at: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
      created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    }),
  },
  {
    file: 'knowledge-cards.json',
    table: 'knowledge_cards',
    transform: row => ({
      ...row,
      created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    }),
  },
  {
    file: 'idea-history.json',
    table: 'idea_history',
    transform: row => ({
      ...row,
      created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    }),
  },
  {
    file: 'processing-ledger.json',
    table: 'processing_ledger',
    transform: row => ({
      ...row,
      created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    }),
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(DRY_RUN ? '=== backfill-json-to-pg (DRY RUN) ===' : '=== backfill-json-to-pg ===')
  log(`Config dir: ${CONFIG_DIR}`)
  log('')

  const client = DRY_RUN
    ? ({} as SupabaseClient)
    : getClient()

  let totalRows = 0
  let totalTables = 0

  for (const { file, table, transform } of TABLES) {
    const rows = readJson<Record<string, unknown>>(file)
    const mapped = transform ? rows.map(transform) : rows
    await upsert(client, table, mapped)
    totalRows += mapped.length
    totalTables++
  }

  log('')
  log(`Done. ${totalTables} tables processed, ${totalRows} rows total.`)

  if (DRY_RUN) {
    log('\nRe-run without --dry-run to apply changes.')
  } else {
    log('\nJSON → Supabase backfill complete. You can now set FORGEPILOT_STORAGE=postgres.')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
