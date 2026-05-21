import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getStorageMode, getStorageStatus } from './cutover-config'

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const originals: Record<string, string | undefined> = {}
  for (const key of Object.keys(vars)) {
    originals[key] = process.env[key]
    if (vars[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = vars[key]
    }
  }
  try {
    fn()
  } finally {
    for (const key of Object.keys(originals)) {
      if (originals[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originals[key]
      }
    }
  }
}

describe('getStorageMode', () => {
  it('defaults to json when STORAGE_MODE is not set', () => {
    withEnv({ STORAGE_MODE: undefined }, () => {
      expect(getStorageMode()).toBe('json')
    })
  })

  it('returns dual when STORAGE_MODE=dual', () => {
    withEnv({ STORAGE_MODE: 'dual' }, () => {
      expect(getStorageMode()).toBe('dual')
    })
  })

  it('returns postgres when STORAGE_MODE=postgres', () => {
    withEnv({ STORAGE_MODE: 'postgres' }, () => {
      expect(getStorageMode()).toBe('postgres')
    })
  })

  it('returns json for an unrecognised value', () => {
    withEnv({ STORAGE_MODE: 'mysql' }, () => {
      expect(getStorageMode()).toBe('json')
    })
  })

  it('is case-insensitive', () => {
    withEnv({ STORAGE_MODE: 'POSTGRES' }, () => {
      expect(getStorageMode()).toBe('postgres')
    })
  })
})

describe('getStorageStatus', () => {
  it('json mode without postgres → has risks', () => {
    withEnv({ STORAGE_MODE: undefined, DATABASE_URL: undefined, SUPABASE_URL: undefined }, () => {
      const status = getStorageStatus()
      expect(status.mode).toBe('json')
      expect(status.risks.length).toBeGreaterThan(0)
      expect(status.jsonFallbackActive).toBe(true)
      expect(status.postgresConfigured).toBe(false)
    })
  })

  it('postgres mode + DATABASE_URL → production-ready recommendation', () => {
    withEnv({ STORAGE_MODE: 'postgres', DATABASE_URL: 'postgresql://localhost/test', SUPABASE_URL: undefined }, () => {
      const status = getStorageStatus()
      expect(status.mode).toBe('postgres')
      expect(status.postgresConfigured).toBe(true)
      expect(status.jsonFallbackActive).toBe(false)
      expect(status.recommendation).toContain('Production-ready')
      expect(status.risks).toHaveLength(0)
    })
  })

  it('postgres mode without DATABASE_URL → risk reported', () => {
    withEnv({ STORAGE_MODE: 'postgres', DATABASE_URL: undefined, SUPABASE_URL: undefined }, () => {
      const status = getStorageStatus()
      expect(status.risks.length).toBeGreaterThan(0)
      expect(status.risks[0]).toMatch(/DATABASE_URL/)
    })
  })

  it('dual mode + DATABASE_URL → migration recommendation', () => {
    withEnv({ STORAGE_MODE: 'dual', DATABASE_URL: 'postgresql://localhost/test', SUPABASE_URL: undefined }, () => {
      const status = getStorageStatus()
      expect(status.mode).toBe('dual')
      expect(status.recommendation).toContain('Dual-Write')
      expect(status.risks).toHaveLength(0)
    })
  })

  it('dual mode without DATABASE_URL → fallback risk', () => {
    withEnv({ STORAGE_MODE: 'dual', DATABASE_URL: undefined, SUPABASE_URL: undefined }, () => {
      const status = getStorageStatus()
      expect(status.risks.some(r => r.includes('dual'))).toBe(true)
      expect(status.jsonFallbackActive).toBe(true)
    })
  })

  it('SUPABASE_URL counts as postgres configured', () => {
    withEnv({ STORAGE_MODE: 'postgres', DATABASE_URL: undefined, SUPABASE_URL: 'https://abc.supabase.co', }, () => {
      const status = getStorageStatus()
      expect(status.postgresConfigured).toBe(true)
    })
  })
})
