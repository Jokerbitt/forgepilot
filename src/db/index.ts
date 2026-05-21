import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = ReturnType<typeof drizzle<typeof schema>>

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const client = postgres(url, { max: 10, idle_timeout: 30, prepare: false })
  _db = drizzle(client, { schema, logger: false })
  return _db
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
