import { describe, it, expect } from 'vitest'
import {
  getKeyAgeDays,
  getRotationStatuses,
  hasStaleKeys,
  ROTATION_THRESHOLD_DAYS,
  type ApiKeysMeta,
} from './rotation-tracker'

/** Build a meta record with a key set N days ago. */
function makeSetAt(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
}

describe('getKeyAgeDays', () => {
  it('returns 0 for a key set just now', () => {
    expect(getKeyAgeDays(new Date().toISOString())).toBe(0)
  })

  it('returns correct days for a key set 30 days ago', () => {
    expect(getKeyAgeDays(makeSetAt(30))).toBe(30)
  })

  it('returns correct days for a key set 91 days ago', () => {
    expect(getKeyAgeDays(makeSetAt(91))).toBe(91)
  })
})

describe('getRotationStatuses', () => {
  it('marks a fresh key as not stale', () => {
    const meta: ApiKeysMeta = { GITHUB_TOKEN: { setAt: makeSetAt(10) } }
    const [status] = getRotationStatuses(meta)
    expect(status.keyName).toBe('GITHUB_TOKEN')
    expect(status.isStale).toBe(false)
    expect(status.ageDays).toBe(10)
  })

  it('marks a key at exactly threshold as stale', () => {
    const meta: ApiKeysMeta = {
      ANTHROPIC_API_KEY: { setAt: makeSetAt(ROTATION_THRESHOLD_DAYS) },
    }
    const [status] = getRotationStatuses(meta)
    expect(status.isStale).toBe(true)
  })

  it('marks a key older than threshold as stale', () => {
    const meta: ApiKeysMeta = {
      LINEAR_API_KEY: { setAt: makeSetAt(ROTATION_THRESHOLD_DAYS + 5) },
    }
    const [status] = getRotationStatuses(meta)
    expect(status.isStale).toBe(true)
  })

  it('returns empty array for empty meta', () => {
    expect(getRotationStatuses({})).toEqual([])
  })

  it('respects custom threshold', () => {
    const meta: ApiKeysMeta = { KEY: { setAt: makeSetAt(30) } }
    const [status] = getRotationStatuses(meta, 20)
    expect(status.isStale).toBe(true)
  })
})

describe('hasStaleKeys', () => {
  it('returns false when no keys are stale', () => {
    const meta: ApiKeysMeta = {
      GITHUB_TOKEN: { setAt: makeSetAt(10) },
      LINEAR_API_KEY: { setAt: makeSetAt(50) },
    }
    expect(hasStaleKeys(meta)).toBe(false)
  })

  it('returns true when at least one key is stale', () => {
    const meta: ApiKeysMeta = {
      GITHUB_TOKEN: { setAt: makeSetAt(10) },
      ANTHROPIC_API_KEY: { setAt: makeSetAt(95) },
    }
    expect(hasStaleKeys(meta)).toBe(true)
  })

  it('returns false for empty meta', () => {
    expect(hasStaleKeys({})).toBe(false)
  })
})

describe('ROTATION_THRESHOLD_DAYS', () => {
  it('is 90', () => {
    expect(ROTATION_THRESHOLD_DAYS).toBe(90)
  })
})
