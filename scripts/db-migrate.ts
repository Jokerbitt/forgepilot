import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import dotenv from 'dotenv'
import postgres from 'postgres'

async function main() {
  dotenv.config({ path: '.env.local' })
  dotenv.config()

  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('DATABASE_URL not set - skipping migration')
    process.exit(0)
  }
  const client = postgres(url, { max: 1 })
  const db = drizzle(client)
  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  console.log('Migrations complete')
  await client.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
