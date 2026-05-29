import { describe, expect, it } from 'vitest'
import { compareDelegationStores, compareProjectBriefStores } from './cutover-verification'

describe('compareDelegationStores', () => {
  it('marks stores ready when ids and key fields match', () => {
    const result = compareDelegationStores(
      [{ id: 'd1', title: 'Auth', status: 'completed' }],
      [{ id: 'd1', title: 'Auth', status: 'completed' }],
    )

    expect(result.readyForPostgresPrimary).toBe(true)
    expect(result.jsonCount).toBe(1)
    expect(result.postgresCount).toBe(1)
    expect(result.missingInPostgres).toEqual([])
    expect(result.missingInJson).toEqual([])
    expect(result.mismatched).toEqual([])
  })

  it('reports json records missing from postgres', () => {
    const result = compareDelegationStores(
      [
        { id: 'd1', title: 'Auth', status: 'completed' },
        { id: 'd2', title: 'Cutover', status: 'pending' },
      ],
      [{ id: 'd1', title: 'Auth', status: 'completed' }],
    )

    expect(result.readyForPostgresPrimary).toBe(false)
    expect(result.missingInPostgres).toEqual(['d2'])
  })

  it('allows postgres to contain historical records missing from json', () => {
    const result = compareDelegationStores(
      [{ id: 'd1', title: 'Auth', status: 'completed' }],
      [
        { id: 'd1', title: 'Auth', status: 'completed' },
        { id: 'd2', title: 'Cutover', status: 'pending' },
      ],
    )

    expect(result.readyForPostgresPrimary).toBe(true)
    expect(result.missingInJson).toEqual(['d2'])
  })

  it('can require exact json/postgres parity for strict audits', () => {
    const result = compareDelegationStores(
      [{ id: 'd1', title: 'Auth', status: 'completed' }],
      [
        { id: 'd1', title: 'Auth', status: 'completed' },
        { id: 'd2', title: 'Cutover', status: 'pending' },
      ],
      { allowPostgresSuperset: false },
    )

    expect(result.readyForPostgresPrimary).toBe(false)
    expect(result.missingInJson).toEqual(['d2'])
  })

  it('reports mismatched title and status fields', () => {
    const result = compareDelegationStores(
      [{ id: 'd1', title: 'Auth', status: 'completed' }],
      [{ id: 'd1', title: 'Auth v2', status: 'failed' }],
    )

    expect(result.readyForPostgresPrimary).toBe(false)
    expect(result.mismatched).toEqual([
      { id: 'd1', field: 'title', jsonValue: 'Auth', postgresValue: 'Auth v2' },
      { id: 'd1', field: 'status', jsonValue: 'completed', postgresValue: 'failed' },
    ])
  })
})

describe('compareProjectBriefStores', () => {
  it('uses the same readiness rules for project briefs', () => {
    const result = compareProjectBriefStores(
      [{ id: 'b1', title: 'Brief', status: 'accepted' }],
      [{ id: 'b1', title: 'Brief', status: 'accepted' }],
    )

    expect(result.readyForPostgresPrimary).toBe(true)
  })
})
