import type { Config } from 'drizzle-kit'

/**
 * Drizzle Kit configuration.
 *
 * Commands:
 *   npx drizzle-kit generate   → generate SQL migration files from schema
 *   npx drizzle-kit push       → push schema directly to DB (dev only!)
 *   npx drizzle-kit studio     → open Drizzle Studio in browser
 *   npx drizzle-kit migrate    → run pending migrations
 */
export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://forgepilot:forgepilot@localhost:5432/forgepilot',
  },
  // Keep migration files in source control — never edit them manually
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
  verbose: true,
  strict: true,
} satisfies Config
