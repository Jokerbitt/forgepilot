# Postgres / Supabase Connector

Move from the local-first **SQLite** default to **Postgres/Supabase** with a
single datasource change — your Prisma models and queries stay identical.

## When
- Multi-user cloud, hosted deployment, or you need Realtime / Storage / RLS.
- Stay on SQLite (the `database` block) for local-first, single-user, or dev.

## Switch SQLite → Postgres (3 steps)
1. Replace the `datasource`/`generator` block in `prisma/schema.prisma` with
   `datasource.prisma` from this connector.
2. Set env to your Supabase connection string:
   ```
   DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true"  # pooled
   DIRECT_URL="postgresql://...:5432/postgres"                   # migrations
   ```
3. `npx prisma migrate deploy && npx prisma generate`

## Optional: Supabase client (Storage / Realtime / RLS)
`client.ts` → `src/lib/supabase/client.ts`. Install `@supabase/supabase-js`.
Use Prisma for app data; use the Supabase client only for Storage/Realtime/RLS.
Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
