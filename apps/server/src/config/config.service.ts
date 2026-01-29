import type { Env } from './env.js'
import process from 'node:process'
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import { safeParseEnv } from './env.js'

@Injectable()
export class ConfigService {
  private readonly env: Env
  private readonly logger: Logger

  constructor(@Inject(Logger) logger: Logger) {
    this.logger = logger

    const result = safeParseEnv()

    if (!result.success) {
      this.logger.error('❌ Invalid environment variables:')
      result.error.issues.forEach((issue) => {
        this.logger.error(`  - ${issue.path.join('.')}: ${issue.message}`)
      })
      process.exit(1)
    }

    this.env = result.data
  }

  /**
   * Get all environment variables
   */
  getAll(): Env {
    return { ...this.env }
  }

  /**
   * Get a specific environment variable
   * TODO: Add convenience methods for your specific environment variables
   *
   * Example:
   * get port(): number {
   *   return this.env.PORT
   * }
   *
   * get isDevelopment(): boolean {
   *   return this.env.NODE_ENV === 'development'
   * }
   */
}
