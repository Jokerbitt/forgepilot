/**
 * Supabase Client — Optional Integration
 *
 * Supabase is fully optional. When SUPABASE_URL + SUPABASE_ANON_KEY are
 * configured, ForgePilot gets:
 *   - Persistent storage (replaces JSON files)
 *   - Realtime subscriptions (no more polling)
 *   - pgvector semantic search (for Knowledge Center + Context Engineering)
 *   - DSGVO-ready audit logs with EU data residency option
 *
 * Without Supabase: everything falls back to local JSON files — works
 * on any system, offline, NAS, CI, without any external service.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readStoredApiKeys } from '@/lib/connectors/config'

let _client: SupabaseClient | null = null

function getCredentials(): { url: string; anonKey: string } | null {
  const url     = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (url && anonKey) return { url, anonKey }

  // Also check stored keys (user configured via Settings UI)
  const stored  = readStoredApiKeys() as Record<string, string | undefined>
  const storedUrl = stored.SUPABASE_URL
  const storedKey = stored.SUPABASE_ANON_KEY

  if (storedUrl && storedKey) return { url: storedUrl, anonKey: storedKey }

  return null
}

/** Returns the Supabase client, or null if not configured. */
export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client

  const creds = getCredentials()
  if (!creds) return null

  _client = createClient(creds.url, creds.anonKey, {
    auth: { persistSession: false },   // server-side: no browser session
  })

  return _client
}

/** Returns true when Supabase is configured and likely reachable. */
export function isSupabaseEnabled(): boolean {
  return getCredentials() !== null
}

/** Invalidate the cached client (e.g. after settings change). */
export function resetSupabaseClient(): void {
  _client = null
}
