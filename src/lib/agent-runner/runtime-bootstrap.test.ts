/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  isSecretKey,
  isPlaceholderValue,
  generateSecret,
  materializeEnv,
  bootstrapRuntime,
  summarizeBootstrap,
} from './runtime-bootstrap'

describe('isSecretKey', () => {
  it('flags secret-like keys', () => {
    for (const k of ['SESSION_SECRET', 'API_KEY', 'JWT_TOKEN', 'DB_PASSWORD', 'SIGNING_SALT', 'KEY']) {
      expect(isSecretKey(k)).toBe(true)
    }
  })
  it('does not flag non-secret keys', () => {
    for (const k of ['DATABASE_URL', 'NEXT_PUBLIC_API_KEY', 'PORT', 'HOST', 'BASE_URL']) {
      expect(isSecretKey(k)).toBe(false)
    }
  })
})

describe('isPlaceholderValue', () => {
  it('detects placeholders', () => {
    for (const v of ['', '""', 'generate-a-random-secret', 'your-key-here', 'change-me', 'replace-this', '<secret>', 'xxxxx']) {
      expect(isPlaceholderValue(v)).toBe(true)
    }
  })
  it('treats real-looking values as non-placeholder', () => {
    expect(isPlaceholderValue('"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"')).toBe(false)
    expect(isPlaceholderValue('file:./dev.db')).toBe(false)
  })
})

describe('generateSecret', () => {
  it('returns 64 hex chars', () => {
    expect(generateSecret()).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('materializeEnv', () => {
  it('replaces placeholder secrets but keeps real values, comments, and non-secrets', () => {
    const example = [
      '# config',
      'DATABASE_URL="file:./dev.db"',
      'SESSION_SECRET="generate-a-random-32-plus-character-secret"',
      '',
      'PORT=3000',
    ].join('\n')
    const out = materializeEnv(example, () => 'DETERMINISTIC_SECRET')
    expect(out).toContain('# config')
    expect(out).toContain('DATABASE_URL="file:./dev.db"')
    expect(out).toContain('SESSION_SECRET="DETERMINISTIC_SECRET"')
    expect(out).toContain('PORT=3000')
  })

  it('preserves an unquoted secret style', () => {
    const out = materializeEnv('SECRET=changeme', () => 'XYZ')
    expect(out).toBe('SECRET=XYZ')
  })

  it('leaves a non-placeholder secret untouched', () => {
    const real = 'SESSION_SECRET="already-a-real-and-long-secret-value-123456"'
    expect(materializeEnv(real, () => 'NEW')).toBe(real)
  })
})

describe('bootstrapRuntime', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-bootstrap-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('no-ops cleanly on a repo without .env.example or prisma', () => {
    const r = bootstrapRuntime({ targetRepo: dir })
    expect(r.env.ran).toBe(false)
    expect(r.prismaGenerate.ran).toBe(false)
    expect(summarizeBootstrap(r)).toBe('Kein Runtime-Bootstrap nötig')
  })

  it('returns empty result for a non-existent repo', () => {
    const r = bootstrapRuntime({ targetRepo: path.join(dir, 'nope') })
    expect(r.env.ran).toBe(false)
  })

  it('creates .env from .env.example with a generated secret', () => {
    fs.writeFileSync(
      path.join(dir, '.env.example'),
      'DATABASE_URL="file:./dev.db"\nSESSION_SECRET="generate-me-please-32-chars-minimum"\n',
    )
    const r = bootstrapRuntime({ targetRepo: dir })
    expect(r.env.ran).toBe(true)
    expect(r.env.ok).toBe(true)
    const env = fs.readFileSync(path.join(dir, '.env'), 'utf-8')
    expect(env).toContain('DATABASE_URL="file:./dev.db"')
    expect(env).toMatch(/SESSION_SECRET="[0-9a-f]{64}"/)
  })

  it('does not overwrite an existing .env', () => {
    fs.writeFileSync(path.join(dir, '.env.example'), 'SESSION_SECRET="placeholder"\n')
    fs.writeFileSync(path.join(dir, '.env'), 'SESSION_SECRET="keep-this"\n')
    const r = bootstrapRuntime({ targetRepo: dir })
    expect(r.env.ran).toBe(false)
    expect(fs.readFileSync(path.join(dir, '.env'), 'utf-8')).toContain('keep-this')
  })
})

describe('summarizeBootstrap', () => {
  it('joins only the steps that ran', () => {
    const s = summarizeBootstrap({
      env: { ran: true, ok: true, detail: '.env erzeugt' },
      prismaGenerate: { ran: false, ok: true, detail: '' },
      prismaMigrate: { ran: true, ok: false, detail: 'prisma migrate deploy fehlgeschlagen: x' },
      seed: { ran: false, ok: true, detail: '' },
    })
    expect(s).toContain('✅ .env erzeugt')
    expect(s).toContain('⚠️ prisma migrate deploy fehlgeschlagen')
    expect(s).not.toContain('Prisma Client')
  })
})
