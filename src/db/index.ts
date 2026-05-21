/**
 * Database connection — postgres-js + Drizzle ORM
 *
 * Single connection pool for the entire application.
 * Connection is lazy: nothing happens until the first query.
 *
 * Guards:
 *   - Only instantiated when DATABASE_URL is set
 *   - getDb() throws clearly if called without a connection string
 *   - No global side-effects at import time
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Database = ReturnType<typeof drizzle<typeof schema>>

// ─── Connection singleton ─────────────────────────────────────────────────────

let _db: Database | null = null
let _client: ReturnType<typeof postgres> | null = null

/**
 * Return the Drizzle database instance.
 * Throws if DATABASE_URL is not configured.
 * Safe to call repeatedly — reuses the existing connection.
 */
export function getDb(): Database {
  if (_db) return _db

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. ' +
      'Add it to .env.local or set POSTGRES_MODE=off to use JSON stores instead.',
    )
  }

  _client = postgres(url, {
    max: 10,                  // connection pool size
    idle_timeout: 30,         // seconds before idle connections close
    connect_timeout: 10,      // seconds to wait for initial connection
    prepare: false,           // required for PgBouncer compatibility
    // Keep queries readable in logs (dev) — redact in prod via LOG_LEVEL
    debug: process.env.NODE_ENV === 'development' && process.env.LOG_LEVEL === 'debug'
      ? (conn, query, params) => console.debug('[db]', query.slice(0, 120), params)
      : false,
  })

  _db = drizzle(_client, { schema, logger: false })
  return _db
}

/**
 * Close the connection pool. Call during graceful shutdown.
 * Safe to call even if no connection was established.
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end()
    _client = null
    _db = null
  }
}

/**
 * True if DATABASE_URL is set in the environment.
 * Use this to guard optional Postgres code paths.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
