/**
 * Supabase Realtime — M91
 *
 * Provides table subscriptions that replace setInterval polling.
 * When Supabase is not configured, subscriptions silently no-op
 * and callers continue using their existing polling fallback.
 *
 * Usage (in a React component or route handler):
 *
 *   const channel = subscribeToTable('delegations', (payload) => {
 *     // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
 *     // payload.new: the new row data
 *     refreshDelegations()
 *   })
 *
 *   // Cleanup on unmount:
 *   return () => { void unsubscribe(channel) }
 */

import { getSupabaseClient } from './client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: RealtimeEventType
  new: T
  old: Partial<T>
  table: string
}

type RealtimeCallback<T = Record<string, unknown>> = (payload: RealtimePayload<T>) => void

/**
 * Subscribe to INSERT/UPDATE/DELETE events on a Supabase table.
 * Returns the channel (needed for cleanup) or null when Supabase is not configured.
 */
export function subscribeToTable<T = Record<string, unknown>>(
  table: string,
  callback: RealtimeCallback<T>,
  event: RealtimeEventType = '*',
): RealtimeChannel | null {
  const sb = getSupabaseClient()
  if (!sb) return null  // no-op when Supabase not configured

  const channel = sb
    .channel(`table:${table}:${Date.now()}`)
    .on(
      'postgres_changes' as Parameters<RealtimeChannel['on']>[0],
      { event, schema: 'public', table },
      (payload: unknown) => {
        const p = payload as { eventType: string; new: T; old: Partial<T> }
        callback({
          eventType: p.eventType as RealtimeEventType,
          new: p.new,
          old: p.old,
          table,
        })
      },
    )
    .subscribe()

  return channel
}

/**
 * Unsubscribe from a Realtime channel.
 * Safe to call with null (no-op).
 */
export async function unsubscribe(channel: RealtimeChannel | null): Promise<void> {
  if (!channel) return
  const sb = getSupabaseClient()
  if (!sb) return
  await sb.removeChannel(channel)
}

/**
 * React hook for Realtime table subscriptions.
 * Automatically unsubscribes on component unmount.
 *
 * Example:
 *   useRealtimeTable('delegations', () => void refresh())
 */
export function useRealtimeTable<T = Record<string, unknown>>(
  table: string,
  callback: RealtimeCallback<T>,
  event: RealtimeEventType = '*',
): void {
  // Lazy import React to avoid SSR issues
  // This function is intentionally a no-op declaration;
  // the actual hook implementation is in src/hooks/useRealtimeTable.ts
  // to keep this lib file dependency-free.
  void table; void callback; void event
}
