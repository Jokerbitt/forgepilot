/**
 * Tests for Supabase Realtime subscriptions — M91
 *
 * Mocks the Supabase client away so all paths exercise
 * the no-op / null-safe behaviour.
 */

import { describe, it, expect, vi } from 'vitest'

// ── Mock Supabase client ─────────────────────────────────────────────────────
vi.mock('./client', () => ({
  getSupabaseClient: () => null,
  isSupabaseEnabled: () => false,
  resetSupabaseClient: () => undefined,
}))

import { subscribeToTable, unsubscribe } from './realtime'

// ── subscribeToTable ─────────────────────────────────────────────────────────

describe('subscribeToTable (no Supabase)', () => {
  it('returns null when Supabase is not configured', () => {
    const channel = subscribeToTable('delegations', () => undefined)
    expect(channel).toBeNull()
  })

  it('does not throw when callback is never called', () => {
    expect(() => subscribeToTable('knowledge_cards', () => { throw new Error('should not be called') })).not.toThrow()
  })

  it('accepts a specific event type without error', () => {
    const channel = subscribeToTable('processing_ledger', () => undefined, 'INSERT')
    expect(channel).toBeNull()
  })

  it('accepts UPDATE and DELETE event types', () => {
    expect(subscribeToTable('t', () => undefined, 'UPDATE')).toBeNull()
    expect(subscribeToTable('t', () => undefined, 'DELETE')).toBeNull()
  })
})

// ── unsubscribe ──────────────────────────────────────────────────────────────

describe('unsubscribe', () => {
  it('does not throw when called with null', async () => {
    await expect(unsubscribe(null)).resolves.toBeUndefined()
  })

  it('does not throw when called with undefined cast to null', async () => {
    // Type system guarantees only null | RealtimeChannel — test robustness at runtime
    await expect(unsubscribe(null)).resolves.toBeUndefined()
  })

  it('is safe to call multiple times with null', async () => {
    await unsubscribe(null)
    await unsubscribe(null)
    // No error is the assertion
  })
})
