import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

describe('Deployment configuration', () => {
  it('.env.example contains required auth variables', () => {
    const content = readFileSync(join(process.cwd(), '.env.example'), 'utf-8')
    expect(content).toContain('NEXTAUTH_SECRET')
    expect(content).toContain('FORGEPILOT_ADMIN_PASSWORD')
    expect(content).toContain('NEXTAUTH_URL')
  })

  it('.env.example documents DATABASE_URL', () => {
    const content = readFileSync(join(process.cwd(), '.env.example'), 'utf-8')
    expect(content).toContain('DATABASE_URL')
  })

  it('vercel.json exists and is valid JSON', () => {
    const p = join(process.cwd(), 'vercel.json')
    expect(existsSync(p)).toBe(true)
    expect(() => JSON.parse(readFileSync(p, 'utf-8'))).not.toThrow()
  })

  it('docker-compose.yml exists', () => {
    expect(existsSync(join(process.cwd(), 'docker-compose.yml'))).toBe(true)
  })

  it('db:migrate script exists', () => {
    expect(existsSync(join(process.cwd(), 'scripts/db-migrate.ts'))).toBe(true)
  })

  it('Drizzle migrations folder contains SQL files', () => {
    const migrationsDir = join(process.cwd(), 'src/db/migrations')
    expect(existsSync(migrationsDir)).toBe(true)
    const sqlFiles = readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql'))
    expect(sqlFiles.length).toBeGreaterThan(0)
  })
})
