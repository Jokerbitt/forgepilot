import { describe, expect, it } from 'vitest'
import { getDelegationStorageMode } from './delegationRepository'

describe('getDelegationStorageMode', () => {
  it('defaults to json when no database is configured', () => {
    expect(getDelegationStorageMode({})).toBe('json')
  })

  it('uses postgres when DATABASE_URL is present', () => {
    expect(getDelegationStorageMode({ DATABASE_URL: 'postgresql://localhost/forgepilot' })).toBe(
      'postgres'
    )
  })

  it('allows an explicit dual-write migration mode', () => {
    expect(
      getDelegationStorageMode({
        DATABASE_URL: 'postgresql://localhost/forgepilot',
        FORGEPILOT_DELEGATION_STORAGE: 'dual',
      })
    ).toBe('dual')
  })

  it('ignores unknown storage modes and derives mode from DATABASE_URL', () => {
    expect(
      getDelegationStorageMode({
        DATABASE_URL: 'postgresql://localhost/forgepilot',
        FORGEPILOT_DELEGATION_STORAGE: 'sqlite',
      })
    ).toBe('postgres')
  })
})
