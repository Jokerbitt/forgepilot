/**
 * Supabase client connector. Requires: npm i @supabase/supabase-js
 *
 * Use ALONGSIDE Prisma, not instead of it:
 *   - Prisma  → typed queries, migrations, relations (your app's data layer)
 *   - Supabase client → Storage, Realtime, and Row-Level-Security auth flows
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   (browser-safe, RLS-gated)
 *   SUPABASE_SERVICE_ROLE_KEY       (server only — NEVER expose to the client)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

/** Browser/client-side Supabase client (anon key, RLS-gated). */
export function createBrowserSupabase(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}

/**
 * Server-side Supabase client with the service-role key — bypasses RLS.
 * Only ever import this in server code (route handlers, server actions).
 */
export function createServiceSupabase(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
