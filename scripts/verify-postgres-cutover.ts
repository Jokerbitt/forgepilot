#!/usr/bin/env npx tsx
/**
 * Verify that core JSON data and Postgres rows are aligned.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npm run db:verify-cutover
 *
 * Exits with:
 *   0 when Postgres is ready to become the primary delegation read path
 *   1 when DATABASE_URL is missing, the DB query fails, or stores differ
 */

import fs from 'fs'
import path from 'path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { delegations, projectBriefs } from '../src/db/schema'
import {
  compareDelegationStores,
  compareProjectBriefStores,
  type JsonDelegationSnapshot,
  type JsonProjectBriefSnapshot,
  type PostgresDelegationSnapshot,
  type PostgresProjectBriefSnapshot,
} from '../src/lib/storage/cutover-verification'

const DATABASE_URL = process.env.DATABASE_URL
const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')
const PROJECT_BRIEFS_FILE = path.join(process.cwd(), 'config', 'project-briefs.json')

function readJsonSnapshots(filePath: string): Array<JsonDelegationSnapshot | JsonProjectBriefSnapshot> {
  if (!fs.existsSync(filePath)) return []

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain an array`)
  }

  return parsed.map((item) => {
    const delegation = item as Partial<JsonDelegationSnapshot>
    if (!delegation.id) throw new Error('Every JSON delegation must have an id')
    return {
      id: delegation.id,
      title: delegation.title,
      status: delegation.status,
    }
  })
}

function readJsonDelegations(): JsonDelegationSnapshot[] {
  return readJsonSnapshots(DELEGATIONS_FILE) as JsonDelegationSnapshot[]
}

function readJsonProjectBriefs(): JsonProjectBriefSnapshot[] {
  return readJsonSnapshots(PROJECT_BRIEFS_FILE) as JsonProjectBriefSnapshot[]
}

async function readPostgresDelegations(url: string): Promise<PostgresDelegationSnapshot[]> {
  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client, { logger: false })
  try {
    const rows = await db
      .select({
        id: delegations.id,
        title: delegations.title,
        status: delegations.status,
      })
      .from(delegations)

    return rows
  } finally {
    await client.end()
  }
}

async function readPostgresProjectBriefs(url: string): Promise<PostgresProjectBriefSnapshot[]> {
  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client, { logger: false })
  try {
    return await db
      .select({
        id: projectBriefs.id,
        title: projectBriefs.title,
        status: projectBriefs.status,
      })
      .from(projectBriefs)
  } finally {
    await client.end()
  }
}

async function main(): Promise<void> {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set. Cannot verify Postgres cutover.')
    process.exit(1)
  }

  const jsonDelegations = readJsonDelegations()
  const jsonProjectBriefs = readJsonProjectBriefs()
  const postgresDelegations = await readPostgresDelegations(DATABASE_URL)
  const postgresProjectBriefs = await readPostgresProjectBriefs(DATABASE_URL)
  const delegationComparison = compareDelegationStores(jsonDelegations, postgresDelegations)
  const projectBriefComparison = compareProjectBriefStores(jsonProjectBriefs, postgresProjectBriefs)
  const readyForPostgresPrimary =
    delegationComparison.readyForPostgresPrimary &&
    projectBriefComparison.readyForPostgresPrimary

  console.log(JSON.stringify({
    readyForPostgresPrimary,
    delegations: delegationComparison,
    projectBriefs: projectBriefComparison,
  }, null, 2))

  if (!readyForPostgresPrimary) {
    console.error('\nPostgres cutover verification failed. Keep STORAGE_MODE=dual or json until fixed.')
    process.exit(1)
  }

  console.log('\nPostgres cutover verification passed. STORAGE_MODE=postgres is safe for core V1 stores.')
}

main().catch((error: unknown) => {
  console.error('Fatal cutover verification error:', error)
  process.exit(1)
})
