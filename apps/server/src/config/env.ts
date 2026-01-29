import type { Logger } from 'nestjs-pino'
import process from 'node:process'
import { z } from 'zod'

/**
 * Environment variables schema
 * TODO: Add your environment variables here
 *
 * Example:
 * const envSchema = z.object({
 *   PORT: z.coerce.number().int().min(1).max(65535).default(3000),
 *   NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
 *   DATABASE_URL: z.string().url(),
 *   JWT_SECRET: z.string(),
 * })
 */
const envSchema = z.object({
  // TODO: Define your environment variables here
})

/**
 * Parse and validate environment variables
 */
export function parseEnv() {
  return envSchema.parse(process.env)
}

/**
 * Safe parse environment variables with error handling
 */
export function safeParseEnv() {
  return envSchema.safeParse(process.env)
}

/**
 * Infer type from schema
 */
export type Env = z.infer<typeof envSchema>

/**
 * Validate environment variables at startup
 * Note: Logger can be passed after NestJS app is initialized.
 * For pre-initialization validation, console.error is used as fallback.
 */
export function validateEnv(logger?: Logger): Env {
  const result = safeParseEnv()

  if (!result.success) {
    const logError = (message: string) => {
      logger ? logger.error(message) : console.error(message)
    }

    logError('❌ Invalid environment variables:')
    result.error.issues.forEach((issue) => {
      logError(`  - ${issue.path.join('.')}: ${issue.message}`)
    })
    process.exit(1)
  }

  return result.data
}
