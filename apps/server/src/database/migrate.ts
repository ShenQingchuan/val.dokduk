import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Run database migrations using drizzle-orm runtime migrator
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const sql = postgres(connectionString, { max: 1 })
  const db = drizzle(sql)

  await migrate(db, {
    migrationsFolder: join(__dirname, 'migrations'),
  })

  await sql.end()
}
