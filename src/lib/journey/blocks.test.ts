import { describe, it, expect } from 'vitest'
import { JOURNEY_BLOCKS, findBlock, blockToStep } from './blocks'

describe('JOURNEY_BLOCKS', () => {
  it('has unique ids and includes login', () => {
    const ids = JOURNEY_BLOCKS.map(b => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('login')
  })
})

describe('blockToStep', () => {
  it('builds a step that references the connector for login', () => {
    const step = blockToStep('login')
    expect(step).not.toBeNull()
    expect(step!.title).toBe('Login & Registrierung')
    expect(step!.description).toContain('connector-oauth')
    expect(step!.description).toMatch(/erhalten/)
  })

  it('builds a step without a connector mention for payments', () => {
    const step = blockToStep('payments')
    expect(step!.description).not.toContain('connector-')
  })

  it('returns null for an unknown block', () => {
    expect(blockToStep('does-not-exist')).toBeNull()
  })
})

describe('findBlock', () => {
  it('finds a known block', () => {
    expect(findBlock('email')?.connector).toBe('connector-email')
  })
})
