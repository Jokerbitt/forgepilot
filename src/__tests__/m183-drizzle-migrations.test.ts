/**
 * M183 — Drizzle SQL Migrations tests
 * Verifies that migration files and the db:migrate script are present.
 * No live DB connection required — CI does not have a Postgres instance.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../../')
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'src/db/migrations')
const DB_MIGRATE_SCRIPT = resolve(REPO_ROOT, 'scripts/db-migrate.ts')

describe('M183 — Drizzle migrations', () => {
  it('db-migrate script exists at scripts/db-migrate.ts', () => {
    expect(existsSync(DB_MIGRATE_SCRIPT)).toBe(true)
  })

  it('migrations folder exists', () => {
    expect(existsSync(MIGRATIONS_DIR)).toBe(true)
  })

  it('migrations folder contains at least one .sql file', () => {
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    expect(sqlFiles.length).toBeGreaterThanOrEqual(1)
  })

  it('package.json contains db:migrate script', async () => {
    const pkg = (await import('../../package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts['db:migrate']).toBe('tsx scripts/db-migrate.ts')
  })

  it('initial migration SQL contains all three tables', () => {
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    const firstSql = require('fs').readFileSync(resolve(MIGRATIONS_DIR, sqlFiles[0]), 'utf-8')
    expect(firstSql).toContain('CREATE TABLE "delegations"')
    expect(firstSql).toContain('CREATE TABLE "project_briefs"')
    expect(firstSql).toContain('CREATE TABLE "knowledge_cards"')
  })

  it('initial migration SQL contains all 5 enums', () => {
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    const firstSql = require('fs').readFileSync(resolve(MIGRATIONS_DIR, sqlFiles[0]), 'utf-8')
    expect(firstSql).toContain('delegation_status')
    expect(firstSql).toContain('risk_class')
    expect(firstSql).toContain('execution_route')
    expect(firstSql).toContain('project_brief_status')
    expect(firstSql).toContain('knowledge_card_type')
  })

  it('migration SQL preserves current delegation fields', () => {
    const sql = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((file) => require('fs').readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8'))
      .join('\n')

    expect(sql).toContain("ADD VALUE 'rejected'")
    expect(sql).toContain('ADD COLUMN "context_snapshot" jsonb')
  })
})
