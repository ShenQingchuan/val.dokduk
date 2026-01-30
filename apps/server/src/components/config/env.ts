import type { Logger } from 'nestjs-pino'
import process from 'node:process'
import { z } from 'zod'

/**
 * Environment variables schema
 */
const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(7070),
  NODE_ENV: z
    .enum([
      'development',
      'production',
      'test',
    ])
    .default('development'),
  ENABLE_FILE_LOG: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .default(true),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Henrik API
  HENRIK_API_KEY: z.string().min(1),
  HENRIK_API_BASE_URL: z.url().default('https://api.henrikdev.xyz'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Cloudflare Turnstile
  TURNSTILE_SECRET_KEY: z.string().min(1),

  // Frontend URL (for CORS and redirects)
  FRONTEND_URL: z.url().default('http://localhost:3000'),
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
